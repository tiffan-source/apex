import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals";
import { MessageViewModel } from "./chat.models";
import { SessionStore } from "../../../chore/stores/session.store";
import { computed, inject } from "@angular/core";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { EMPTY, catchError, concatMap, defer, exhaustMap, from, pipe, switchMap, takeWhile, tap, timer } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { CREATE_STAGE_TOOL, CREATE_TASK_TOOL, MessageMapper } from "./message.mapper";
import { whenSignedIn } from "../../../chore/stores/utils/filter-auth-operation";
import { isTemporaryId, withOptimistiqueId } from "../../../chore/stores/utils/map-optimistique-id";
import { AnnoncesStore } from "../../../chore/stores/annonces.store";
import { AkariWritesStore } from "../../../chore/stores/akari-writes.store";
import { AssistantApi } from "../../../chore/api/assistant.api";
import { ApiError, errorCodeOf, isUnknownOutcome, retryWhileTransient } from "../../../chore/api/api-error";
import { FAILURE_REPORTS } from "../../../chore/constants/messages.constante";
import type {
  RegisteredMessage,
  ToolCall,
  WorkflowState,
  WorkflowStateValue,
  WorkflowStatus,
} from "../../../chore/api/api.models";

export type ChatState = {
  messages: MessageViewModel[];
  isStreaming: boolean;
  isLoading: boolean;
  /** L'historique a été chargé (ou n'a pas pu l'être) : une conversation vide est alors vraiment vide. */
  historyLoaded: boolean;
  /** L'objectif dont le workflow d'Akari est suivi (l'API identifie un workflow par son objectif). */
  objectiveId?: string;
  /** Où en est le workflow, d'après l'API ; null tant que son état n'est pas connu. */
  workflowStatus: WorkflowStatus | null;
  /** L'étape en cours du workflow, pour la phrase de la ligne d'état. */
  workflowState: WorkflowStateValue;
  pendingToolCall: ToolCall | null;
}

const initialState: ChatState = {
  messages: [],
  isStreaming: false,
  isLoading: false,
  historyLoaded: false,
  objectiveId: undefined,
  workflowStatus: null,
  workflowState: "",
  pendingToolCall: null
};


const WRITE_TOOLS = new Set<string>([CREATE_STAGE_TOOL, CREATE_TASK_TOOL]);

/** L'intervalle d'interrogation de l'état du workflow pendant un tour (l'API ne pousse rien). */
export const AKARI_POLL_INTERVAL = 1000;

/**
 * Les lectures en panne passagère avant de le dire. L'état du workflow (et la conversation relue à la fin
 * d'un tour) est relu sans limite, de plus en plus espacé : la note vient avec le quatrième nouvel essai
 * (vers 7 s) et reste jusqu'à ce que le serveur réponde. La conversation ouverte avec l'écran n'est relue
 * que quatre fois (1 s, 2 s, 4 s, 8 s) avant de le dire.
 */
export const AKARI_RETRIES_BEFORE_REPORT = 4;

/** Ce que fait Akari pendant un tour, dit dans la ligne d'état (voix d'Empreinte, sans jargon). */
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
  /** Le serveur ne répond plus pendant un tour : l'écran continue de l'interroger, la note part dès qu'il répond. */
  unreachable: "Je n'arrive pas à te répondre pour l'instant. Vérifie ta connexion, je réessaie en attendant.",
  /** Un envoi resté sans réponse, que la conversation relue ne contient pas : le serveur ne l'a pas reçu. */
  notSent: "Ton message ne m'est pas parvenu. Réessaie de me l'envoyer.",
  /** Le tour s'est arrêté sur le serveur (IA indisponible…) : le message de la personne est enregistré. */
  turnInterrupted: "Je n'ai pas pu terminer ma réponse. Réessaie dans un instant.",
  /** Un tour est déjà en cours (dans un autre onglet…). */
  busy: "Je réponds encore à ton message précédent. Attends ma réponse, puis réessaie.",
  messageTooLong: "Ton message est trop long. Raccourcis-le, puis réessaie.",
  tooManyMessages: "Beaucoup de messages à la suite. Attends une minute, puis réessaie.",
} as const;

/**
 * La phrase à signaler quand la conversation ou le workflow ne répond pas comme prévu, d'après le code
 * d'erreur de l'API ; `fallback` sans code connu (réseau, panne du serveur…).
 */
export function akariFailureReport(fallback: string, errorCode?: string): string {
  switch (errorCode) {
    case "TOO_MANY_REQUESTS":
      return AKARI_REPORTS.tooManyMessages;
    case "UNAUTHENTICATED":
    case "INVALID_SESSION":
      return FAILURE_REPORTS.sessionEnded;
    default:
      return fallback;
  }
}

/** La phrase à signaler quand un message ne part pas, d'après le code d'erreur de l'API. */
export function sendFailureReport(errorCode?: string): string {
  switch (errorCode) {
    case "WORKFLOW_BUSY":
      return AKARI_REPORTS.busy;
    case "VALIDATION_ERROR":
    case "PAYLOAD_TOO_LARGE":
      return AKARI_REPORTS.messageTooLong;
    default:
      return akariFailureReport(AKARI_REPORTS.startConversation, errorCode);
  }
}

/**
 * La phrase à signaler quand la réponse à une demande d'accord n'aboutit pas ; null quand l'interrogation
 * qui suit suffit : la demande avait déjà sa réponse (NO_PENDING_PERMISSION, un autre onglet), ou le
 * serveur n'a pas répondu (sa note vient avec l'interrogation, et la demande revient à l'écran si la
 * réponse n'est pas arrivée).
 */
export function answerFailureReport(error: unknown): string | null {
  const code = errorCodeOf(error);
  if (code === "NO_PENDING_PERMISSION" || (error instanceof ApiError && error.status === 0)) return null;
  if (isUnknownOutcome(error)) return AKARI_REPORTS.turnInterrupted;
  return akariFailureReport(AKARI_REPORTS.startConversation, code);
}

/**
 * La conversation avec Akari sur un objectif. Le workflow d'Akari tourne sur le serveur (Apex Brain) :
 * l'écran envoie un message ou sa réponse à une demande d'accord, puis interroge l'état chaque seconde
 * jusqu'au repos (prêt, ou en attente d'un accord).
 */
export const ChatStore = signalStore(
  withState<ChatState>(initialState),
  withComputed((store) => ({
    orderLatestMessages: computed(() => [...store.messages()].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())),
    // On ne peut écrire que lorsque le workflow est au repos et attend un nouveau message ;
    // tout autre état veut dire qu'un tour est encore en cours sur cette conversation.
    canSendMessage: computed(() => store.workflowStatus() === "ready"),
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
    assistant = inject(AssistantApi),
    sessionStore = inject(SessionStore),
    // Fourni par la coque (comme ObjectiveStore) : le rechargement après une écriture acceptée survit au
    // départ de l'écran Akari, que ChatStore quitte avec lui.
    akariWrites = inject(AkariWritesStore),
    annonces = inject(AnnoncesStore)
  )=> {
    // La panne de tour déjà connue (lastError.at) : l'état la rend jusqu'au message suivant, seule une
    // panne nouvelle est signalée.
    let knownErrorAt: string | null = null;

    // La conversation, avec quelques nouveaux essais en cas de panne passagère (réseau, serveur qui se réveille).
    const readConversation = (objectiveId: string) =>
      defer(() => assistant.conversation(objectiveId)).pipe(retryWhileTransient({ maxRetries: AKARI_RETRIES_BEFORE_REPORT }));

    // Une lecture relancée tant que la panne est passagère : au bout de quelques essais, la personne apprend
    // que le serveur ne répond pas ; la note s'en va dès qu'il répond de nouveau.
    const untilAnswered = <T>(read: () => Promise<T>) =>
      defer(read).pipe(
        retryWhileTransient<T>({
          onRetry: (retryCount) => {
            if (retryCount === AKARI_RETRIES_BEFORE_REPORT) annonces.signaler(AKARI_REPORTS.unreachable);
          },
        }),
        tap(() => annonces.retirer(AKARI_REPORTS.unreachable))
      );

    const readState = (objectiveId: string) => untilAnswered(() => assistant.state(objectiveId));

    // Affiche un message que le workflow vient d'enregistrer (de la personne ou d'Akari) sans
    // recharger toute la conversation. Le message de la personne était déjà affiché à l'envoi
    // (optimiste) : on remplace son id temporaire par le vrai ; celui d'Akari est ajouté à la suite.
    // Dédoublonné par id : les états répétés de l'interrogation n'ajoutent jamais deux fois le même.
    // Rend le message ajouté, ou null s'il était déjà là.
    const upsertRegisteredMessage = (registered: RegisteredMessage): MessageViewModel | null => {
      const messages = store.messages();

      if (messages.some((message) => message.id === registered.id)) {
        return null;
      }

      const view: MessageViewModel = {
        id: registered.id,
        content: registered.content,
        sender: MessageMapper.senderOf(registered.sender),
        timestamp: new Date(registered.createdAt),
      };

      if (view.sender === "user") {
        // Le dernier envoyé d'abord : un message plus ancien au même texte peut attendre encore sa relecture.
        let optimisticIndex = -1;
        for (let index = messages.length - 1; index >= 0 && optimisticIndex === -1; index--) {
          const message = messages[index];
          if (message.sender === "user" && isTemporaryId(message.id) && message.content === view.content) optimisticIndex = index;
        }

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

    // Relit la conversation à la fin d'un tour quand un message de la personne garde son id temporaire :
    // l'interrogation ne l'a pas vu enregistré, ou son envoi est resté sans réponse. Chaque message en
    // attente retrouve sa copie enregistrée (même texte, pas encore affichée) et prend sa place. Un message
    // qui attendait déjà avant la relecture et n'a pas de copie n'est pas arrivé : il quitte la conversation,
    // et la personne en est prévenue. La relecture continue tant que la panne est passagère.
    const refreshHistory = rxMethod<string>(
      pipe(
        switchMap((objectiveId) => {
          const pending = new Set(store.messages().filter((message) => isTemporaryId(message.id)).map((message) => message.id));
          return untilAnswered(() => assistant.conversation(objectiveId)).pipe(
            tapResponse({
              next: (conversation) => {
                const messages = store.messages();
                const refreshed = MessageMapper.fromConversationToMessages(conversation);
                const shown = new Set(messages.filter((message) => !isTemporaryId(message.id)).map((message) => message.id));
                const copies = refreshed
                  .filter((message) => message.sender === "user" && !shown.has(message.id))
                  .map((message) => message.content);
                // Dans l'ordre de l'envoi : les messages qui attendaient avant la relecture d'abord.
                const unmatched = messages.filter((message) => {
                  if (!isTemporaryId(message.id)) return false;
                  const copy = copies.indexOf(message.content);
                  if (copy !== -1) copies.splice(copy, 1);
                  return copy === -1;
                });

                patchState(store, { messages: [...refreshed, ...unmatched.filter((message) => !pending.has(message.id))] });
                if (unmatched.some((message) => pending.has(message.id))) annonces.signaler(AKARI_REPORTS.notSent);
              },
              error: (error) => {
                console.error(error);
                // Les messages en attente le restent : une page rechargée dira s'ils sont arrivés.
                if (pending.size > 0) annonces.signaler(akariFailureReport(AKARI_REPORTS.loadConversation, errorCodeOf(error)));
              },
            })
          );
        })
      )
    );

    // Un état du workflow rendu par l'API : la ligne d'état, la demande d'accord, le dernier message.
    const applyState = (state: WorkflowState) => {
      // Un tour était en cours avant cet état : un message d'Akari qui arrive est une nouvelle réponse
      // (et non le dernier message d'une conversation reprise).
      const previous = store.workflowStatus();
      const wasRunning = previous === "processing" || previous === "awaiting-permission";
      const awaitingPermission = state.status === "awaiting-permission";
      // Une panne nouvelle, et non celle d'un tour plus ancien que l'état rend encore.
      const errorAt = state.lastError?.at ?? null;
      const newError = errorAt !== null && errorAt !== knownErrorAt;
      knownErrorAt = errorAt;

      patchState(store, {
        objectiveId: state.objectiveId,
        workflowStatus: state.status,
        workflowState: state.value,
        // Pendant l'attente d'un accord, Akari ne « réfléchit » plus : l'écran montre sa
        // demande, avec « Ajouter » et « Pas maintenant ».
        isStreaming: state.status === "processing",
        pendingToolCall: awaitingPermission ? state.pendingToolCall : null,
      });

      if (state.lastRegisteredMessage) {
        const added = upsertRegisteredMessage(state.lastRegisteredMessage);
        if (added?.sender === "assistant" && wasRunning) {
          annonces.annoncer(AKARI_REPLIED);
        }
      }

      if (wasRunning && state.status === "ready") {
        // Le tour s'est arrêté sur une panne (IA indisponible…) : la personne peut réessayer.
        if (newError) annonces.signaler(AKARI_REPORTS.turnInterrupted);
        if (store.messages().some((message) => isTemporaryId(message.id))) refreshHistory(state.objectiveId);
      }
    };

    // Interroge l'état du workflow chaque seconde (une requête à la fois), jusqu'au repos : prêt pour un
    // message, ou en attente d'un accord. Une panne passagère ne l'arrête pas (readState).
    const watchWorkflowState = rxMethod<string>(
      pipe(
        switchMap((objectiveId) =>
          timer(0, AKARI_POLL_INTERVAL).pipe(
            exhaustMap(() => readState(objectiveId)),
            takeWhile((state) => state.status === "processing", true),
            tap((state) => applyState(state)),
            catchError((error) => {
              // L'API refuse de rendre l'état (objectif introuvable, session terminée…) : rien ne marchera
              // sur cette page avant de la recharger.
              console.error(error);
              annonces.signaler(akariFailureReport(AKARI_REPORTS.startConversation, errorCodeOf(error)));
              patchState(store, { isStreaming: false });
              return EMPTY;
            })
          )
        )
      )
    );

    // La réponse à une demande d'accord, puis l'interrogation jusqu'au repos.
    const followAnswer = rxMethod<{ objectiveId: string; answered: Promise<WorkflowState> }>(
      pipe(
        concatMap(({ objectiveId, answered }) =>
          from(answered).pipe(
            tap((state) => {
              applyState(state);
              watchWorkflowState(objectiveId);
            }),
            catchError((error) => {
              console.error(error);
              // L'état est relu : une demande qui n'a pas reçu la réponse revient à l'écran.
              const report = answerFailureReport(error);
              if (report) annonces.signaler(report);
              watchWorkflowState(objectiveId);
              return EMPTY;
            })
          )
        )
      )
    );

    return {
    /**
     * Ouvre le workflow de l'objectif : son état dit aussitôt où il en est. Un tour interrompu (rechargement,
     * redémarrage du serveur) reprend sur le serveur sans attendre un nouveau message, et l'écran le suit.
     */
    initWorkflow: (objectiveId: string) => {
      patchState(store, { objectiveId, workflowStatus: null, workflowState: "", pendingToolCall: null });
      watchWorkflowState(objectiveId);
    },
    loadChatHistory: rxMethod<{objectifId: string}>(
      pipe(
        whenSignedIn(sessionStore.isAuthenticated),
        tap(()=> patchState(store, { isLoading: true, historyLoaded: false })),
        switchMap(({objectifId}) =>
          readConversation(objectifId).pipe(
            tapResponse({
              next: (conversation) => patchState(store, { messages: MessageMapper.fromConversationToMessages(conversation), isLoading: false, historyLoaded: true }),
              error: (error)=>{
                console.error(error);
                annonces.signaler(akariFailureReport(AKARI_REPORTS.loadConversation, errorCodeOf(error)));
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
        whenSignedIn(sessionStore.isAuthenticated),
        withOptimistiqueId(),
        tap(({tempId, message, objectiveId})=> patchState(store, {
          objectiveId,
          // Un tour commence : plus d'envoi possible avant la réponse d'Akari.
          workflowStatus: "processing",
          isStreaming: true,
          messages: [...store.messages(), {
            id: tempId, // id temporaire, jusqu'à ce que le workflow enregistre le message
            content: message,
            sender: "user",
            timestamp: new Date()
          }]
        })),
        concatMap(({tempId, message, objectiveId}) =>
          from(assistant.sendMessage(objectiveId, message)).pipe(
            tap((state) => {
              applyState(state);
              watchWorkflowState(objectiveId);
            }),
            catchError((error) => {
              console.error(error);
              if (isUnknownOutcome(error)) {
                // Le serveur a pu recevoir le message avant que la réponse se perde : il reste affiché (en
                // attente) et l'état du workflow est relu. À la fin du tour, la conversation relue dit s'il a
                // été enregistré ; sinon, il la quitte et la personne en est prévenue (refreshHistory).
                watchWorkflowState(objectiveId);
                return EMPTY;
              }
              // Refusé : le message n'a pas été pris en compte.
              annonces.signaler(sendFailureReport(errorCodeOf(error)));
              patchState(store, {
                isStreaming: false,
                // L'état réel du workflow (un tour déjà en cours ailleurs…) est relu, sans compter le repos
                // qui arrive comme la fin d'un tour de cette page.
                workflowStatus: null,
                messages: store.messages().filter((message) => message.id !== tempId),
              });
              watchWorkflowState(objectiveId);
              return EMPTY;
            })
          )
        )
      )
    ),
    // Transmet la décision de la personne à l'outil en attente. Si une écriture est acceptée
    // (une étape, un pas), AkariWritesStore recharge les objectifs dès qu'elle est faite : l'arête
    // se remplit au fil des ajouts, même si la personne quitte l'écran avant la fin du tour.
    respondToPermission: (permission: boolean) => {
      const objectiveId = store.objectiveId?.();
      const call = store.pendingToolCall();
      if (!objectiveId || !call) {
        return;
      }

      patchState(store, { pendingToolCall: null, workflowStatus: "processing", isStreaming: true });
      const answered = assistant.respondToPermission(objectiveId, permission, call.id);
      if (permission && WRITE_TOOLS.has(call.name)) {
        akariWrites.reloadAfterWrite({ objectiveId, answered });
      }
      followAnswer({ objectiveId, answered });
    }
    };
  }),
  withHooks(() => {
    const annonces = inject(AnnoncesStore);
    return {
      // Hors de l'écran Akari, plus rien n'interroge le serveur : la note qui disait « je réessaie » s'en va.
      onDestroy: () => annonces.retirer(AKARI_REPORTS.unreachable),
    };
  })
)
