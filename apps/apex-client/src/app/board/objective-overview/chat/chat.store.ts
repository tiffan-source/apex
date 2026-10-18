import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals";
import { MessageViewModel } from "./chat.models";
import { SessionStore } from "apps/apex-client/src/chore/stores/session.store";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { concatMap, from, map, pipe, switchMap, takeWhile, tap, timer } from "rxjs";
import { GetConversationsQuery } from "@org/chat";
import { tapResponse } from "@ngrx/operators";
import { MessageMapper } from "./message.mapper";
import { withOwnerId } from "apps/apex-client/src/chore/stores/utils/filter-auth-operation";
import { RegisteredMessage, SendMessageToAIWorkflow, WorkflowStateValue, WORKFLOW_READY_FOR_NEW_MESSAGE } from "@org/ai-assistant";
import { withOptimistiqueId } from "apps/apex-client/src/chore/stores/utils/map-optimistique-id";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";

export type ChatState = {
  messages: MessageViewModel[];
  isStreaming: boolean;
  isLoading: boolean;
  interactionId?: string;
  workflowState: WorkflowStateValue;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isLoading: false,
  // Empty until the workflow reports its first state; never the ready value, so
  // the chat input stays disabled until we know the workflow can accept a message.
  workflowState: ""
};

// Friendly, user-facing wording for each processing step of the workflow. It
// tells the user what is happening without leaking the inner mechanics of the
// state machine; anything not listed falls back to a neutral "thinking" label.
const PROCESSING_STATUS_LABELS: Record<string, string> = {
  RegisteringUserMessageInConversation: "Saving your message…",
  SendingPromptToAI: "Thinking…",
  ExecutingAllTool: "Looking things up…",
  SendingCallResultToAI: "Making sense of what I found…",
  RegisteringAIResponseInConversation: "Writing the answer…",
};

export const ChatStore = signalStore(
  withState<ChatState>(initialState),
  withComputed((store) => ({
    orderLatestMessages: computed(() => [...store.messages()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())),
    // The user can only write while the workflow is idle and waiting for a new
    // message; any other state means a process is still running on that chat.
    canSendMessage: computed(() => store.workflowState() === WORKFLOW_READY_FOR_NEW_MESSAGE),
    // A friendly description of what the workflow is currently doing, shown while
    // a turn is running (see `isStreaming`). Compound steps report their parent
    // step (e.g. "ExecutingAllTool"), which is enough to pick a label.
    processingStatus: computed(() => {
      const state = store.workflowState();
      const stateName = typeof state === "string" ? state : Object.keys(state)[0] ?? "";
      return PROCESSING_STATUS_LABELS[stateName] ?? "Thinking…";
    }),
  })),
  withMethods((store,
    queryConversation = inject(GetConversationsQuery),
    sessionStore = inject(SessionStore),
    workflow = inject(SendMessageToAIWorkflow)
  )=> {
    // Surface a message the workflow has just persisted (user or AI) without
    // reloading the whole conversation. The user message was already shown
    // optimistically on send, so we reconcile its temporary id with the real
    // one; the AI message is simply appended. Deduplicated by id so the repeated
    // snapshots of the poll never add the same message twice.
    const upsertRegisteredMessage = (registered: RegisteredMessage) => {
      const messages = store.messages();

      if (messages.some((message) => message.id === registered.id)) {
        return;
      }

      const view: MessageViewModel = {
        id: registered.id,
        content: registered.content,
        sender: registered.sender === sessionStore.currentUserId() ? "user" : "assistant",
        timestamp: new Date(registered.createdAt),
      };

      if (view.sender === "user") {
        const optimisticIndex = messages.findIndex(
          (message) => message.sender === "user" && message.id.startsWith("temp-id-") && message.content === view.content
        );

        if (optimisticIndex !== -1) {
          const reconciled = [...messages];
          reconciled[optimisticIndex] = view;
          patchState(store, { messages: reconciled });
          return;
        }
      }

      patchState(store, { messages: [...messages, view] });
    };

    const watchWorkflowState = rxMethod<string>(
      pipe(
        switchMap((workflowId) =>
          timer(0, 1000).pipe(
            map(() => workflow.getState(workflowId)),
            takeWhile((snapshot) => !!snapshot && snapshot.value !== WORKFLOW_READY_FOR_NEW_MESSAGE, true),
            tap((snapshot) => {
              patchState(store, {
                workflowState: snapshot?.value ?? "",
                isStreaming: !!snapshot && snapshot.value !== WORKFLOW_READY_FOR_NEW_MESSAGE,
              });

              const registered = snapshot?.context.lastRegisteredMessage;
              if (registered) {
                upsertRegisteredMessage(registered);
              }
            })
          )
        )
      )
    );

    // Start (or resume a previously persisted) workflow as soon as the chat opens,
    // so an interrupted process wakes up and keeps running without waiting for a new
    // message, and the UI immediately reflects whatever it was doing.
    const initWorkflow = rxMethod<string>(
      pipe(
        switchMap((objectiveId) =>
          from(workflow.startWorkFlow(objectiveId)).pipe(
            tap((workflowId) => {
              patchState(store, { interactionId: workflowId });
              watchWorkflowState(workflowId);
            })
          )
        )
      )
    );

    return {
    initWorkflow,
    loadChatHistory: rxMethod<{objectifId: string}>(
      pipe(
        tap(()=> patchState(store, { isLoading: true })),
        withOwnerId(sessionStore.currentUserId),
        switchMap(({ownerId, objectifId}) =>
          from(queryConversation.execute(objectifId)).pipe(
            tapResponse({
              next: (data) => patchState(store, { messages: MessageMapper.fromConversationQueryToMessages(data, ownerId), isLoading: false }),
              error: (error)=>{
                console.error(error);
                patchState(store, { isLoading: false });
              }
            })
          )
        )
      )
    ),
    clearMessages: ()=>{
      patchState(store, { messages: [] });
    },
    watchWorkflowState,
    sendMessageToAi: rxMethod<{message: string, objectiveId: string}>(
      pipe(
        tap(()=> patchState(store, { isStreaming: true })),
        withOwnerId(sessionStore.currentUserId),
        withOptimistiqueId(),
        tap(({tempId, message})=> patchState(store, { messages: [...store.messages(), {
          id: tempId, // temporary id until the message is confirmed by the workflow
          content: message,
          sender: "user",
          timestamp: new Date()
        }] })),
        // The workflow is identified by the objective id: startWorkFlow restores it
        // when it already exists (the chat already has messages) or starts a new one
        // otherwise. It resolves to the workflow id (the objective id).
        concatMap((data) =>
          from(workflow.startWorkFlow(data.objectiveId)).pipe(
            map((workflowId) => ({ ...data, workflowId }))
          )
        ),
        tap(({workflowId, ownerId, objectiveId, message}) => {
          patchState(store, { interactionId: workflowId });
          workflow.sendMessage(workflowId, ownerId, objectiveId, message)
          watchWorkflowState(workflowId);
        })
      )
    )
    };
  }),
  withHooks((store)=>({

  }))
)
