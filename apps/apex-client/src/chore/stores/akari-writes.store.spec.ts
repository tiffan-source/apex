import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatStore } from '../../app/objective/akari/chat.store';
import { AssistantApi } from '../api/assistant.api';
import { ApiError } from '../api/api-error';
import type { ToolCall, WorkflowState } from '../api/api.models';
import { AKARI_WRITE_MAX_POLLS, AKARI_WRITE_POLL_INTERVAL, AkariWritesStore, isExecutingTool } from './akari-writes.store';
import { AnnoncesStore } from './annonces.store';
import { ObjectiveStore } from './objective.store';
import { SessionStore } from './session.store';

/*
 * Ce qu'Akari ajoute arrive sur l'arête au fil des ajouts (cahier, § 5) : rechargement dès que l'outil
 * accepté est exécuté sur le serveur, même si l'écran Akari (et son ChatStore) est parti entre-temps.
 */

const READY = 'Ready For New Message';
const EXECUTING = { ExecutingAllTool: 'ExecutingTool' };
const ASKING = { ExecutingAllTool: 'WaitingForUserPermission' };
const STAGE_CALL: ToolCall = { id: 'call-1', name: 'createSubObjective', arguments: { parentObjectiveId: 'semi', title: 'Portfolio' } };
const TASK_CALL: ToolCall = { id: 'call-2', name: 'createTask', arguments: { objectiveId: 'portfolio', title: 'Trois projets' } };

const state = (value: WorkflowState['value'], overrides: Partial<WorkflowState> = {}): WorkflowState => ({
  objectiveId: 'semi',
  value,
  status: value === READY ? 'ready' : 'processing',
  pendingToolCall: null,
  lastRegisteredMessage: null,
  lastError: null,
  ...overrides,
});
const asking = (call: ToolCall) => state(ASKING, { status: 'awaiting-permission', pendingToolCall: call });

function setup() {
  let current = state(READY);
  const assistant = {
    conversation: vi.fn().mockResolvedValue({ id: 'c1', messages: [] }),
    state: vi.fn(async () => current),
    sendMessage: vi.fn(async () => current),
    // Comme l'API : accepter fait passer aussitôt à l'exécution de l'outil, et la réponse (202) le dit.
    respondToPermission: vi.fn(async (_objectiveId: string, granted: boolean) => {
      if (granted) current = state(EXECUTING);
      return current;
    }),
  };
  const objectives = { loadObjectives: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      AkariWritesStore,
      { provide: AssistantApi, useValue: assistant },
      { provide: ObjectiveStore, useValue: objectives },
      { provide: SessionStore, useValue: { isAuthenticated: signal(true) } },
      { provide: AnnoncesStore, useValue: { annoncer: vi.fn(), signaler: vi.fn(), retirer: vi.fn() } },
    ],
  });

  return {
    store: TestBed.inject(AkariWritesStore),
    assistant,
    objectives,
    setState: (next: WorkflowState) => (current = next),
  };
}

/** L'écran Akari : un ChatStore dans son propre injecteur, détruit quand on quitte l'écran. */
function openAkariScreen() {
  const injector = createEnvironmentInjector([ChatStore], TestBed.inject(EnvironmentInjector));
  return { chat: injector.get(ChatStore), leave: () => injector.destroy() };
}

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

describe('isExecutingTool', () => {
  it('ne reconnaît que l’exécution d’un outil', () => {
    expect(isExecutingTool(EXECUTING)).toBe(true);
    expect(isExecutingTool(ASKING)).toBe(false);
    expect(isExecutingTool({ ExecutingAllTool: 'PreparingNextTool' })).toBe(false);
    expect(isExecutingTool('SendingCallResultToAI')).toBe(false);
    expect(isExecutingTool(undefined)).toBe(false);
  });
});

describe('AkariWritesStore', () => {
  it('recharge les objectifs une fois l’outil exécuté, pas avant, et une seule fois', async () => {
    const { store, objectives, setState } = setup();
    setState(state(EXECUTING));
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.resolve(state(EXECUTING)) });
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();

    setState(state('SendingCallResultToAI'));
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);

    await tick(5 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('recharge tout de suite quand l’outil avait déjà tourné à la réponse de l’API', async () => {
    const { store, assistant, objectives } = setup();
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.resolve(state('SendingCallResultToAI')) });
    await tick();
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
    expect(assistant.state).not.toHaveBeenCalled();
  });

  it('une panne passagère pendant l’écriture : l’état est relu jusqu’à ce que le serveur réponde, puis l’arête se remplit', async () => {
    const { store, assistant, objectives, setState } = setup();
    setState(state('SendingCallResultToAI'));
    assistant.state
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0, 'Http failure response'))
      .mockRejectedValueOnce(new ApiError('UNKNOWN_ERROR', 503, 'Service unavailable'))
      .mockRejectedValueOnce(new ApiError('NETWORK_ERROR', 0, 'Http failure response'));
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.resolve(state(EXECUTING)) });

    // Première lecture à 1 s, puis nouveaux essais 1 s, 2 s et 4 s plus tard.
    await tick(1000 + 1000 + 2000);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
    await tick(4000);
    expect(assistant.state).toHaveBeenCalledTimes(4);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('un état refusé : les objectifs sont rechargés quand même, l’écriture a sans doute eu lieu', async () => {
    const { store, assistant, objectives } = setup();
    assistant.state.mockRejectedValue(new ApiError('OBJECTIVE_NOT_FOUND', 404, 'Objective not found'));
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.resolve(state(EXECUTING)) });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(1);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('un outil qui tarde : au bout d’une minute, les objectifs sont rechargés quand même, une fois', async () => {
    const { store, assistant, objectives, setState } = setup();
    setState(state(EXECUTING));
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.resolve(state(EXECUTING)) });
    await tick((AKARI_WRITE_MAX_POLLS - 1) * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(AKARI_WRITE_MAX_POLLS);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
    await tick(5 * AKARI_WRITE_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(AKARI_WRITE_MAX_POLLS);
  });

  it('un accord resté sans réponse claire a pu arriver : l’état est relu, puis l’arête est rechargée', async () => {
    const { store, assistant, objectives, setState } = setup();
    setState(state('SendingCallResultToAI'));
    store.reloadAfterWrite({ objectiveId: 'semi', answered: Promise.reject(new ApiError('NETWORK_ERROR', 0, 'Http failure response')) });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(assistant.state).toHaveBeenCalledTimes(1);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('ne recharge rien quand l’accord n’a pas abouti', async () => {
    const { store, objectives } = setup();
    store.reloadAfterWrite({
      objectiveId: 'semi',
      answered: Promise.reject(new ApiError('NO_PENDING_PERMISSION', 409, 'No pending permission')),
    });
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
  });

  it('deux ajouts dans un même tour : l’arête se remplit après le premier, sans attendre la fin du tour', async () => {
    const { assistant, objectives, setState } = setup();
    // Akari demande une étape, puis un pas, dans le même tour.
    setState(asking(STAGE_CALL));
    const { chat } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();
    expect(chat.isAwaitingPermission()).toBe(true);
    chat.respondToPermission(true);
    expect(assistant.respondToPermission).toHaveBeenCalledWith('semi', true, 'call-1');
    await tick();
    expect(objectives.loadObjectives).not.toHaveBeenCalled();

    // L'étape est écrite ; Akari demande déjà le pas suivant : le tour n'est pas fini, l'arête se remplit.
    setState(asking(TASK_CALL));
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
    expect(chat.isAwaitingPermission()).toBe(true);

    chat.respondToPermission(true);
    expect(assistant.respondToPermission).toHaveBeenLastCalledWith('semi', true, 'call-2');
    await tick();
    setState(state('SendingCallResultToAI'));
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(2);

    setState(state(READY));
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(2);
  });

  it('écran quitté avant la fin de l’écriture : les objectifs sont rechargés quand même', async () => {
    const { objectives, setState } = setup();
    setState(asking(STAGE_CALL));
    const { chat, leave } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();

    chat.respondToPermission(true);
    leave(); // « Voir l'arête », ou la matrice : ChatStore part avec l'écran, avant même la réponse de l'API

    await tick();
    setState(state('SendingCallResultToAI'));
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('ne recharge rien quand la personne refuse', async () => {
    const { objectives, setState } = setup();
    setState(asking(STAGE_CALL));
    const { chat } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();

    chat.respondToPermission(false);
    setState(state(READY));
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
  });
});
