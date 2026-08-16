import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals";
import { MessageViewModel } from "./chat.models";
import { SessionStore } from "apps/apex-client/src/chore/stores/session.store";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, pipe, switchMap, tap } from "rxjs";
import { GetAllMessagesQuery } from "@org/chat";
import { tapResponse } from "@ngrx/operators";
import { MessageMapper } from "./message.mapper";
import { withOwnerId } from "apps/apex-client/src/chore/stores/utils/filter-auth-operation";
import { SendMessageToAIWorkflow } from "@org/ai-assistant";
import { withOptimistiqueId } from "apps/apex-client/src/chore/stores/utils/map-optimistique-id";
import { marked } from 'marked';

export type ChatState = {
  messages: MessageViewModel[];
  isStreaming: boolean;
  isLoading: boolean;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isLoading: false
};

export const ChatStore = signalStore(
  withState<ChatState>(initialState),
  withComputed((store) => ({
    orderLatestMessages: computed(() => [...store.messages()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())),
  })),
  withMethods((store,
    queryConversation = inject(GetAllMessagesQuery),
    sessionStore = inject(SessionStore),
    sendMessageToAi = inject(SendMessageToAIWorkflow)
  )=>({
    loadChatHistory: rxMethod<{objectifId: string}>(
      pipe(
        tap(()=> patchState(store, { isLoading: true })),
        withOwnerId(sessionStore.currentUserId),
        switchMap(({ownerId, objectifId}) =>
          from(queryConversation.execute({ externalReferenceId: objectifId })).pipe(
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
    sendMessageToAi: rxMethod<{message: string, objectiveId: string}>(
      pipe(
        tap(()=> patchState(store, { isStreaming: true })),
        withOwnerId(sessionStore.currentUserId),
        withOptimistiqueId(),
        tap(({tempId, message})=> patchState(store, { messages: [...store.messages(), {
          id: tempId,
          content: message,
          sender: "user",
          timestamp: new Date()
        }] })),
        switchMap(({message, objectiveId, ownerId}) =>
          from(sendMessageToAi.execute({ message, objectiveId, ownerId })).pipe(
            tapResponse({
              next: (data) => patchState(store, { messages: [...store.messages(), MessageMapper.fromMessageOutputToViewModel(data)], isStreaming: false }),
              error: (error)=>{
                console.error(error);
                patchState(store, { isStreaming: false });
              }
            })
          )
        )
      )
    )
  }))
)
