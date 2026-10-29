import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { SessionStore } from '../../../chore/stores/session.store';
import { AnnoncesStore } from '../../../chore/stores/annonces.store';
import { AkariWritesStore } from '../../../chore/stores/akari-writes.store';
import { isTemporaryId } from '../../../chore/stores/utils/map-optimistique-id';
import { AssistantApi } from '../../../chore/api/assistant.api';
import { ApiError } from '../../../chore/api/api-error';
import type { ToolCall, WorkflowState } from '../../../chore/api/api.models';
import { voiceIssues } from '../../../chore/constants/messages.constante';
import { AKARI_POLL_INTERVAL, AKARI_REPLIED, AKARI_REPORTS, AKARI_STATUS, ChatStore, sendFailureReport } from './chat.store';

/*
 * La conversation avec Akari, API simulée : historique, envoi optimiste, interrogation de l'état toutes les
 * secondes, demande d'accord, écriture acceptée confiée à AkariWritesStore, pannes, annonces.
 */

const READY = 'Ready For New Message';
const STAGE_CALL: ToolCall = { id: 'call-1', name: 'createSubObjective', arguments: { parentObjectiveId: 'semi', title: 'Portfolio' } };
const TASK_CALL: ToolCall = {
  id: 'call-2',
  name: 'createTask',
  arguments: { objectiveId: 'endurance', title: 'Courir 10 km', importance: 3, urgency: 2 },
};

/** Un état du workflow tel que l'API le rend : au repos par défaut. */
const ready = (overrides: Partial<WorkflowState> = {}): WorkflowState => ({
  objectiveId: 'semi',
  value: READY,
  status: 'ready',
  pendingToolCall: null,
  lastRegisteredMessage: null,
  lastError: null,
  ...overrides,
});
const processing = (value: WorkflowState['value'], overrides: Partial<WorkflowState> = {}) =>
  ready({ value, status: 'processing', ...overrides });
const asking = (call: ToolCall) =>
  ready({ value: { ExecutingAllTool: 'WaitingForUserPermission' }, status: 'awaiting-permission', pendingToolCall: call });
const registered = (id: string, sender: string, content: string) => ({ id, sender, content, createdAt: new Date().toISOString() });

function setup() {
  let state = ready();
  const assistant = {
    conversation: vi.fn().mockResolvedValue({
      id: 'c1',
      messages: [
        { id: 'm2', sender: 'AI', content: 'Bonjour.', createdAt: new Date(2026, 9, 20, 10).toISOString() },
        { id: 'm1', sender: 'u1', content: 'Salut.', createdAt: new Date(2026, 9, 20, 9).toISOString() },
      ],
    }),
    state: vi.fn(async () => state),
    sendMessage: vi.fn(async () => state),
    respondToPermission: vi.fn(async () => state),
  };
  const akariWrites = { reloadAfterWrite: vi.fn() };
  const annonces = { annoncer: vi.fn(), signaler: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      ChatStore,
      { provide: SessionStore, useValue: { isAuthenticated: signal(true) } },
      { provide: AssistantApi, useValue: assistant },
      { provide: AkariWritesStore, useValue: akariWrites },
      { provide: AnnoncesStore, useValue: annonces },
    ],
  });

  return {
    store: TestBed.inject(ChatStore),
    assistant,
    akariWrites,
    annonces,
    setState: (next: WorkflowState) => (state = next),
  };
}

/** Avance le temps (interrogation toutes les secondes) en laissant les promesses se résoudre. */
const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  TestBed.resetTestingModule();
});

describe('ChatStore : l’historique', () => {
  it('charge les messages de l’objectif, dans l’ordre ; « AI » est Akari, tout autre expéditeur la personne', async () => {
    const { store, assistant } = setup();
    expect(store.historyLoaded()).toBe(false);

    store.loadChatHistory({ objectifId: 'semi' });
    expect(store.isLoading()).toBe(true);
    await tick();

    expect(assistant.conversation).toHaveBeenCalledWith('semi');
    expect(store.isLoading()).toBe(false);
    expect(store.historyLoaded()).toBe(true);
    expect(store.orderLatestMessages().map((m) => [m.id, m.sender])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant'],
    ]);
  });

  it('signale une conversation introuvable, sans message technique', async () => {
    const { store, assistant, annonces } = setup();
    assistant.conversation.mockRejectedValue(new ApiError('CONVERSATION_NOT_FOUND', 404, 'No conversation found for reference semi'));
    store.loadChatHistory({ objectifId: 'semi' });
    await tick();
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.loadConversation);
    expect(store.historyLoaded()).toBe(true);
    expect(store.isLoading()).toBe(false);
  });
});

describe('ChatStore : le workflow', () => {
  it('lit l’état à l’ouverture, sans annoncer l’ancien dernier message, et s’arrête au repos', async () => {
    const { store, assistant, annonces, setState } = setup();
    setState(ready({ lastRegisteredMessage: registered('m2', 'AI', 'Bonjour.') }));

    store.initWorkflow('semi');
    expect(store.canSendMessage()).toBe(false);
    await tick();
    expect(assistant.state).toHaveBeenCalledWith('semi');
    expect(store.canSendMessage()).toBe(true);
    expect(store.isStreaming()).toBe(false);
    expect(annonces.annoncer).not.toHaveBeenCalled();

    await tick(3 * AKARI_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(1);
  });

  it('suit un tour interrompu que le serveur a repris, jusqu’à la réponse', async () => {
    const { store, annonces, setState } = setup();
    setState(processing('SendingPromptToAI'));
    store.initWorkflow('semi');
    await tick();
    expect(store.isStreaming()).toBe(true);
    expect(store.canSendMessage()).toBe(false);

    setState(ready({ lastRegisteredMessage: registered('m3', 'AI', 'Me revoilà.') }));
    await tick(AKARI_POLL_INTERVAL);
    expect(store.canSendMessage()).toBe(true);
    expect(annonces.annoncer).toHaveBeenCalledWith(AKARI_REPLIED);
  });

  it('signale un workflow qu’on ne peut pas lire', async () => {
    const { store, assistant, annonces } = setup();
    assistant.state.mockRejectedValue(new ApiError('CONVERSATION_NOT_FOUND', 404, 'No conversation found for reference semi'));
    store.initWorkflow('semi');
    await tick();
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.startConversation);
    expect(store.canSendMessage()).toBe(false);
    // Un refus ne se réessaie pas.
    expect(assistant.state).toHaveBeenCalledTimes(1);
  });

  it('réessaie une panne passagère (serveur qui se réveille) sans rien signaler', async () => {
    const { store, assistant, annonces } = setup();
    assistant.state.mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0, 'Http failure response'));
    store.initWorkflow('semi');
    await tick();
    expect(store.canSendMessage()).toBe(false);

    await tick(AKARI_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(2);
    expect(store.canSendMessage()).toBe(true);
    expect(annonces.signaler).not.toHaveBeenCalled();
  });

  it('envoie, montre ce que fait Akari, puis annonce sa réponse', async () => {
    const { store, assistant, annonces, setState } = setup();
    store.initWorkflow('semi');
    await tick();

    setState(processing('RegisteringUserMessageInConversation'));
    store.sendMessageToAi({ message: 'On commence ?', objectiveId: 'semi' });
    // Le message de la personne s'affiche tout de suite, avec un id temporaire ; un second envoi attend.
    expect(store.messages()).toHaveLength(1);
    expect(isTemporaryId(store.messages()[0].id)).toBe(true);
    expect(store.canSendMessage()).toBe(false);
    await tick();

    expect(assistant.sendMessage).toHaveBeenCalledWith('semi', 'On commence ?');
    expect(store.isStreaming()).toBe(true);
    expect(store.canSendMessage()).toBe(false);
    expect(store.processingStatus()).toBe(AKARI_STATUS.RegisteringUserMessageInConversation);

    // Le workflow a enregistré le message : l'id temporaire est remplacé.
    setState(processing('SendingPromptToAI', { lastRegisteredMessage: registered('m1', 'u1', 'On commence ?') }));
    await tick(AKARI_POLL_INTERVAL);
    expect(store.messages().map((m) => m.id)).toEqual(['m1']);
    expect(store.processingStatus()).toBe('Akari réfléchit…');

    // Une étape composée prend la phrase de son étape parente.
    setState(processing({ ExecutingAllTool: 'PreparingNextTool' }));
    await tick(AKARI_POLL_INTERVAL);
    expect(store.processingStatus()).toBe('Akari regarde ton objectif…');

    setState(ready({ lastRegisteredMessage: registered('m2', 'AI', 'Voici 4 étapes.') }));
    await tick(AKARI_POLL_INTERVAL);
    expect(store.messages().map((m) => [m.id, m.sender])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant'],
    ]);
    expect(store.isStreaming()).toBe(false);
    expect(store.canSendMessage()).toBe(true);
    expect(annonces.annoncer).toHaveBeenCalledWith(AKARI_REPLIED);

    // Au repos, l'interrogation s'arrête : plus aucune requête, rien n'est ajouté.
    const reads = assistant.state.mock.calls.length;
    await tick(3 * AKARI_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(reads);
    expect(store.messages()).toHaveLength(2);
  });

  it('demande l’accord, puis confie l’étape acceptée à AkariWritesStore, qui recharge l’arête dès qu’elle est écrite', async () => {
    const { store, assistant, akariWrites, setState } = setup();
    store.initWorkflow('semi');
    await tick();

    setState(asking(STAGE_CALL));
    store.sendMessageToAi({ message: 'Propose-moi des étapes.', objectiveId: 'semi' });
    await tick();

    expect(store.isAwaitingPermission()).toBe(true);
    expect(store.isStreaming()).toBe(false);
    expect(store.permissionRequest()).toEqual({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });

    setState(processing('SendingCallResultToAI'));
    store.respondToPermission(true);
    // La demande quitte l'écran tout de suite ; la réponse part avec l'id de l'outil.
    expect(store.isAwaitingPermission()).toBe(false);
    expect(assistant.respondToPermission).toHaveBeenCalledWith('semi', true, 'call-1');
    expect(akariWrites.reloadAfterWrite).toHaveBeenCalledTimes(1);
    const [{ objectiveId, answered }] = akariWrites.reloadAfterWrite.mock.calls[0];
    expect(objectiveId).toBe('semi');
    // La réponse de l'API à l'accord, partagée : AkariWritesStore attend qu'elle arrive avant d'interroger l'état.
    expect(typeof answered.then).toBe('function');

    setState(ready());
    await tick(AKARI_POLL_INTERVAL);
    expect(akariWrites.reloadAfterWrite).toHaveBeenCalledTimes(1);
    expect(store.canSendMessage()).toBe(true);
  });

  it('ne confie rien quand la personne refuse', async () => {
    const { store, assistant, akariWrites, setState } = setup();
    store.initWorkflow('semi');
    await tick();
    setState(asking(TASK_CALL));
    store.sendMessageToAi({ message: 'Un pas ?', objectiveId: 'semi' });
    await tick();
    expect(store.permissionRequest()).toEqual({ kind: 'task', title: 'Courir 10 km', objectiveId: 'endurance' });

    setState(ready());
    store.respondToPermission(false);
    expect(assistant.respondToPermission).toHaveBeenCalledWith('semi', false, 'call-2');
    await tick(AKARI_POLL_INTERVAL);
    expect(akariWrites.reloadAfterWrite).not.toHaveBeenCalled();
  });

  it('une demande qui avait déjà sa réponse (un autre onglet) relit l’état sans rien signaler', async () => {
    const { store, assistant, annonces, setState } = setup();
    setState(asking(STAGE_CALL));
    store.initWorkflow('semi');
    await tick();

    assistant.respondToPermission.mockRejectedValueOnce(new ApiError('NO_PENDING_PERMISSION', 409, 'No pending permission'));
    setState(ready());
    store.respondToPermission(true);
    await tick();

    expect(annonces.signaler).not.toHaveBeenCalled();
    expect(store.canSendMessage()).toBe(true);
  });

  it('retire le message et signale quand l’API ne répond pas à l’envoi', async () => {
    const { store, assistant, annonces } = setup();
    store.initWorkflow('semi');
    await tick();
    assistant.sendMessage.mockRejectedValue(new ApiError('NETWORK_ERROR', 0, 'Http failure response'));

    store.sendMessageToAi({ message: 'Bonjour', objectiveId: 'semi' });
    await tick();

    expect(store.messages()).toEqual([]);
    expect(store.isStreaming()).toBe(false);
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.startConversation);
  });

  it('un tour déjà en cours ailleurs : le message est retiré, la phrase le dit, et l’état réel est suivi', async () => {
    const { store, assistant, annonces, setState } = setup();
    store.initWorkflow('semi');
    await tick();
    assistant.sendMessage.mockRejectedValue(new ApiError('WORKFLOW_BUSY', 409, 'Workflow busy'));
    setState(processing('SendingPromptToAI'));

    store.sendMessageToAi({ message: 'Bonjour', objectiveId: 'semi' });
    await tick();

    expect(store.messages()).toEqual([]);
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.busy);
    expect(store.isStreaming()).toBe(true);
    expect(store.canSendMessage()).toBe(false);

    setState(ready());
    await tick(AKARI_POLL_INTERVAL);
    expect(store.canSendMessage()).toBe(true);
  });

  it('un tour arrêté par une panne sur le serveur : la personne peut réessayer, son message reprend son id', async () => {
    const { store, assistant, annonces, setState } = setup();
    store.initWorkflow('semi');
    await tick();

    setState(processing('RegisteringUserMessageInConversation'));
    store.sendMessageToAi({ message: 'On commence ?', objectiveId: 'semi' });
    await tick();

    // L'interrogation n'a pas vu le message enregistré : à la fin du tour, la conversation est relue.
    assistant.conversation.mockResolvedValueOnce({
      id: 'c1',
      messages: [{ id: 'm9', sender: 'u1', content: 'On commence ?', createdAt: new Date().toISOString() }],
    });
    setState(ready({ lastError: { code: 'AI_PROVIDER_UNAVAILABLE', step: 'SendingPromptToAI', at: new Date().toISOString() } }));
    await tick(AKARI_POLL_INTERVAL);

    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.turnInterrupted);
    expect(store.canSendMessage()).toBe(true);
    expect(store.messages().map((m) => m.id)).toEqual(['m9']);
  });
});

describe('la voix d’Akari', () => {
  it.each(Object.values(AKARI_REPORTS))('« %s » parle comme Empreinte et dit quoi faire', (report) => {
    expect(voiceIssues(report)).toEqual([]);
    expect(report).toMatch(/réessaie|recharge la page/i);
  });
});

describe('sendFailureReport', () => {
  it('dit pourquoi un message ne part pas, d’après le code de l’API', () => {
    expect(sendFailureReport('WORKFLOW_BUSY')).toBe(AKARI_REPORTS.busy);
    expect(sendFailureReport('VALIDATION_ERROR')).toBe(AKARI_REPORTS.messageTooLong);
    expect(sendFailureReport('TOO_MANY_REQUESTS')).toBe(AKARI_REPORTS.tooManyMessages);
    expect(sendFailureReport('NETWORK_ERROR')).toBe(AKARI_REPORTS.startConversation);
    expect(sendFailureReport()).toBe(AKARI_REPORTS.startConversation);
  });
});
