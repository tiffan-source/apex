import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals";
import { MessageViewModel } from "./chat.models";
import { SessionStore } from "../../../../chore/stores/session.store";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { concatMap, from, map, pipe, switchMap, takeWhile, tap, timer } from "rxjs";
import { GetConversationsQuery } from "@org/chat";
import { tapResponse } from "@ngrx/operators";
import { MessageMapper } from "./message.mapper";
import { withOwnerId } from "../../../../chore/stores/utils/filter-auth-operation";
import { RegisteredMessage, SendMessageToAIWorkflow, ToolCall, WorkflowStateValue, WORKFLOW_READY_FOR_NEW_MESSAGE } from "@org/ai-assistant";
import { withOptimistiqueId } from "../../../../chore/stores/utils/map-optimistique-id";
import { ObjectiveStore } from "../../../../chore/stores/objective.store";

export type ChatState = {
  messages: MessageViewModel[];
  isStreaming: boolean;
  isLoading: boolean;
  interactionId?: string;
  workflowState: WorkflowStateValue;
  pendingToolCall: ToolCall | null;
  pendingReload: boolean;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isLoading: false,
  interactionId: undefined,
  workflowState: "",
  pendingToolCall: null,
  pendingReload: false
};


const WRITE_TOOLS = new Set<string>(["createSubObjective", "createTask"]);


const isAwaitingPermissionValue = (value: WorkflowStateValue | undefined): boolean =>
  typeof value === "object" && value !== null &&
  (value as Record<string, unknown>)["ExecutingAllTool"] === "WaitingForUserPermission";


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
    // Le workflow attend que l'utilisateur autorise ou refuse un outil.
    isAwaitingPermission: computed(() => store.pendingToolCall() !== null),
  })),
  withMethods((store,
    queryConversation = inject(GetConversationsQuery),
    sessionStore = inject(SessionStore),
    workflow = inject(SendMessageToAIWorkflow),
    // Instance partagée fournie par le Shell : la recharger met à jour la vue
    // détail de l'objectif (qui dérive de ses signaux) sans câblage supplémentaire.
    objectiveStore = inject(ObjectiveStore)
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
              const value = snapshot?.value;
              const awaitingPermission = isAwaitingPermissionValue(value);
              const isReady = value === WORKFLOW_READY_FOR_NEW_MESSAGE;

              patchState(store, {
                workflowState: value ?? "",
                // Pendant l'attente d'une confirmation, on masque l'animation
                // « en cours » : l'UI affiche le prompt Autoriser/Refuser à la place.
                isStreaming: !!snapshot && !isReady && !awaitingPermission,
                pendingToolCall: awaitingPermission ? (snapshot?.context.currentToolCall ?? null) : null,
              });

              const registered = snapshot?.context.lastRegisteredMessage;
              if (registered) {
                upsertRegisteredMessage(registered);
              }

              // Fin de tour : si un outil d'écriture a été autorisé, on recharge
              // le board pour afficher ce que l'IA vient de créer.
              if (isReady && store.pendingReload()) {
                const ownerId = sessionStore.currentUserId();
                if (ownerId) {
                  objectiveStore.loadObjectives({ ownerId });
                }
                patchState(store, { pendingReload: false });
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
    ),
    // Transmet la décision de l'utilisateur à l'outil en attente. Si une écriture
    // est autorisée, on programme le rechargement du board en fin de tour (le
    // résultat de l'outil est effacé du contexte avant le retour à « ready »).
    respondToPermission: (permission: boolean) => {
      const id = store.interactionId?.();
      if (!id) {
        return;
      }

      const call = store.pendingToolCall();
      const willMutate = permission && !!call && WRITE_TOOLS.has(call.name);

      workflow.respondToPermission(id, permission);
      patchState(store, {
        pendingToolCall: null,
        pendingReload: store.pendingReload() || willMutate,
      });
      // On relance le polling jusqu'au retour à « ready ».
      watchWorkflowState(id);
    }
    };
  }),
  withHooks((store)=>({

  }))
)
