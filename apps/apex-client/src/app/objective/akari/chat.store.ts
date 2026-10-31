import { patchState, signalStore, withComputed, withMethods, withState } from "@ngrx/signals";
import { MessageViewModel } from "./chat.models";
import { SessionStore } from "../../../chore/stores/session.store";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { catchError, concatMap, EMPTY, from, map, pipe, switchMap, takeWhile, tap, timer } from "rxjs";
import { GetConversationsQuery } from "@org/chat";
import { tapResponse } from "@ngrx/operators";
import { CREATE_STAGE_TOOL, CREATE_TASK_TOOL, MessageMapper } from "./message.mapper";
import { withOwnerId } from "../../../chore/stores/utils/filter-auth-operation";
import { RegisteredMessage, SendMessageToAIWorkflow, ToolCall, WorkflowStateValue, WORKFLOW_READY_FOR_NEW_MESSAGE } from "@org/ai-assistant";
import { isTemporaryId, withOptimistiqueId } from "../../../chore/stores/utils/map-optimistique-id";
import { AnnoncesStore } from "../../../chore/stores/annonces.store";
import { AkariWritesStore } from "../../../chore/stores/akari-writes.store";

export type ChatState = {
  messages: MessageViewModel[];
  isStreaming: boolean;
  isLoading: boolean;
  /** L'historique a été chargé (ou n'a pas pu l'être) : une conversation vide est alors vraiment vide. */
  historyLoaded: boolean;
  interactionId?: string;
  workflowState: WorkflowStateValue;
  pendingToolCall: ToolCall | null;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isLoading: false,
  historyLoaded: false,
  interactionId: undefined,
  workflowState: "",
  pendingToolCall: null
};


const WRITE_TOOLS = new Set<string>([CREATE_STAGE_TOOL, CREATE_TASK_TOOL]);


const isAwaitingPermissionValue = (value: WorkflowStateValue | undefined): boolean =>
  typeof value === "object" && value !== null &&
  (value as Record<string, unknown>)["ExecutingAllTool"] === "WaitingForUserPermission";


/** Ce que fait Akari pendant un tour, dit dans la ligne d'état (voix d'Apex, sans jargon). */
export const AKARI_STATUS = {
  RegisteringUserMessageInConversation: "Akari note ton message…",
  SendingPromptToAI: "Akari réfléchit…",
  ExecutingAllTool: "Akari regarde ton objectif…",
  SendingCallResultToAI: "Akari fait le point…",
  RegisteringAIResponseInConversation: "Akari écrit sa réponse…",
} as const satisfies Record<string, string>;

/** L'état par défaut, pour une étape du workflow sans phrase à elle. */
export const AKARI_THINKING = AKARI_STATUS.SendingPromptToAI;

/** Annoncé aux lecteurs d'écran quand une réponse d'Akari arrive. */
export const AKARI_REPLIED = "Akari a répondu.";

/** Ce qui n'a pas marché dans la conversation, et quoi faire (signalé par la coque). */
export const AKARI_REPORTS = {
  loadConversation: "Je n'ai pas pu retrouver notre conversation. Vérifie ta connexion, puis recharge la page.",
  startConversation: "Je n'arrive pas à te répondre pour l'instant. Vérifie ta connexion, puis recharge la page.",
} as const;

export const ChatStore = signalStore(
  withState<ChatState>(initialState),
  withComputed((store) => ({
    orderLatestMessages: computed(() => [...store.messages()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())),
    // On ne peut écrire que lorsque le workflow est au repos et attend un nouveau message ;
    // tout autre état veut dire qu'un tour est encore en cours sur cette conversation.
    canSendMessage: computed(() => store.workflowState() === WORKFLOW_READY_FOR_NEW_MESSAGE),
    // Ce que fait Akari pendant un tour (voir `isStreaming`). Une étape composée donne
    // son étape parente (par exemple « ExecutingAllTool »), ce qui suffit à choisir la phrase.
    processingStatus: computed(() => {
      const state = store.workflowState();
      const stateName = typeof state === "string" ? state : Object.keys(state)[0] ?? "";
      return (AKARI_STATUS as Record<string, string>)[stateName] ?? AKARI_THINKING;
    }),
    // Le workflow attend que la personne accepte ou refuse un outil.
    isAwaitingPermission: computed(() => store.pendingToolCall() !== null),
    // Ce qu'Akari demande d'ajouter, pour la phrase de l'écran.
    permissionRequest: computed(() => MessageMapper.toPermissionRequest(store.pendingToolCall())),
  })),
  withMethods((store,
    queryConversation = inject(GetConversationsQuery),
    sessionStore = inject(SessionStore),
    workflow = inject(SendMessageToAIWorkflow),
    // Fourni par la coque (comme ObjectiveStore) : le rechargement après une écriture acceptée survit au
    // départ de l'écran Akari, que ChatStore quitte avec lui.
    akariWrites = inject(AkariWritesStore),
    annonces = inject(AnnoncesStore)
  )=> {
    // Affiche un message que le workflow vient d'enregistrer (de la personne ou d'Akari) sans
    // recharger toute la conversation. Le message de la personne était déjà affiché à l'envoi
    // (optimiste) : on remplace son id temporaire par le vrai ; celui d'Akari est ajouté à la suite.
    // Dédoublonné par id : les instantanés répétés de l'interrogation n'ajoutent jamais deux fois le même.
    // Rend le message ajouté, ou null s'il était déjà là.
    const upsertRegisteredMessage = (registered: RegisteredMessage): MessageViewModel | null => {
      const messages = store.messages();

      if (messages.some((message) => message.id === registered.id)) {
        return null;
      }

      const view: MessageViewModel = {
        id: registered.id,
        content: registered.content,
        sender: registered.sender === sessionStore.currentUserId() ? "user" : "assistant",
        timestamp: new Date(registered.createdAt),
      };

      if (view.sender === "user") {
        const optimisticIndex = messages.findIndex(
          (message) => message.sender === "user" && isTemporaryId(message.id) && message.content === view.content
        );

        if (optimisticIndex !== -1) {
          const reconciled = [...messages];
          reconciled[optimisticIndex] = view;
          patchState(store, { messages: reconciled });
          return view;
        }
      }

      patchState(store, { messages: [...messages, view] });
      return view;
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
              // Un tour était en cours avant cet instantané : un message d'Akari qui arrive est une
              // nouvelle réponse (et non le dernier message d'une conversation reprise).
              const previous = store.workflowState();
              const wasRunning = previous !== "" && previous !== WORKFLOW_READY_FOR_NEW_MESSAGE;

              patchState(store, {
                workflowState: value ?? "",
                // Pendant l'attente d'un accord, Akari ne « réfléchit » plus : l'écran montre sa
                // demande, avec « Ajouter » et « Pas maintenant ».
                isStreaming: !!snapshot && !isReady && !awaitingPermission,
                pendingToolCall: awaitingPermission ? (snapshot?.context.currentToolCall ?? null) : null,
              });

              const registered = snapshot?.context.lastRegisteredMessage;
              if (registered) {
                const added = upsertRegisteredMessage(registered);
                if (added?.sender === "assistant" && wasRunning) {
                  annonces.annoncer(AKARI_REPLIED);
                }
              }
            })
          )
        )
      )
    );

    // Démarre (ou reprend, s'il a été enregistré) le workflow dès l'ouverture de la conversation :
    // un tour interrompu reprend sans attendre un nouveau message, et l'écran montre aussitôt où il en est.
    const initWorkflow = rxMethod<string>(
      pipe(
        switchMap((objectiveId) =>
          from(workflow.startWorkFlow(objectiveId)).pipe(
            tap((workflowId) => {
              patchState(store, { interactionId: workflowId });
              watchWorkflowState(workflowId);
            }),
            catchError((error) => {
              console.error(error);
              annonces.signaler(AKARI_REPORTS.startConversation);
              return EMPTY;
            })
          )
        )
      )
    );

    return {
    initWorkflow,
    loadChatHistory: rxMethod<{objectifId: string}>(
      pipe(
        tap(()=> patchState(store, { isLoading: true, historyLoaded: false })),
        withOwnerId(sessionStore.currentUserId),
        switchMap(({ownerId, objectifId}) =>
          from(queryConversation.execute(objectifId)).pipe(
            tapResponse({
              next: (data) => patchState(store, { messages: MessageMapper.fromConversationQueryToMessages(data, ownerId), isLoading: false, historyLoaded: true }),
              error: (error)=>{
                console.error(error);
                annonces.signaler(AKARI_REPORTS.loadConversation);
                patchState(store, { isLoading: false, historyLoaded: true });
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
          id: tempId, // id temporaire, jusqu'à ce que le workflow enregistre le message
          content: message,
          sender: "user",
          timestamp: new Date()
        }] })),
        // Le workflow est identifié par l'id de l'objectif : startWorkFlow le reprend s'il existe déjà
        // (la conversation a des messages) ou en démarre un nouveau. Il rend l'id du workflow (celui de l'objectif).
        concatMap((data) =>
          from(workflow.startWorkFlow(data.objectiveId)).pipe(
            map((workflowId) => ({ ...data, workflowId })),
            catchError((error) => {
              console.error(error);
              annonces.signaler(AKARI_REPORTS.startConversation);
              patchState(store, {
                isStreaming: false,
                messages: store.messages().filter((message) => message.id !== data.tempId),
              });
              return EMPTY;
            })
          )
        ),
        tap(({workflowId, ownerId, objectiveId, message}) => {
          patchState(store, { interactionId: workflowId });
          workflow.sendMessage(workflowId, ownerId, objectiveId, message)
          watchWorkflowState(workflowId);
        })
      )
    ),
    // Transmet la décision de la personne à l'outil en attente. Si une écriture est acceptée
    // (une étape, un pas), AkariWritesStore recharge les objectifs dès qu'elle est faite : l'arête
    // se remplit au fil des ajouts, même si la personne quitte l'écran avant la fin du tour.
    respondToPermission: (permission: boolean) => {
      const id = store.interactionId?.();
      if (!id) {
        return;
      }

      const call = store.pendingToolCall();
      const willMutate = permission && !!call && WRITE_TOOLS.has(call.name);

      workflow.respondToPermission(id, permission);
      patchState(store, { pendingToolCall: null });
      if (willMutate) {
        akariWrites.reloadAfterWrite(id);
      }
      // On relance l'interrogation jusqu'au retour au repos.
      watchWorkflowState(id);
    }
    };
  })
)
