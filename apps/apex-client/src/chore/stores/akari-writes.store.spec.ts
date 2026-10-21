import { EnvironmentInjector, createEnvironmentInjector, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GetConversationsQuery } from '@org/chat';
import { SendMessageToAIWorkflow, WORKFLOW_READY_FOR_NEW_MESSAGE } from '@org/ai-assistant';
import { ChatStore } from '../../app/objective/akari/chat.store';
import { AKARI_WRITE_POLL_INTERVAL, AkariWritesStore, isExecutingTool } from './akari-writes.store';
import { AnnoncesStore } from './annonces.store';
import { ObjectiveStore } from './objective.store';
import { SessionStore } from './session.store';

/*
 * Ce qu'Akari ajoute arrive sur l'arête au fil des ajouts (cahier, § 5) : rechargement dès que l'outil
 * accepté est exécuté, même si l'écran Akari (et son ChatStore) est parti entre-temps.
 */

type Snapshot = { value: unknown; context: Record<string, unknown> } | undefined;

const READY = WORKFLOW_READY_FOR_NEW_MESSAGE;
const EXECUTING = { ExecutingAllTool: 'ExecutingTool' };
const ASKING = { ExecutingAllTool: 'WaitingForUserPermission' };
const STAGE_CALL = { id: 'call-1', name: 'createSubObjective', arguments: { parentObjectiveId: 'semi', title: 'Portfolio' } };
const TASK_CALL = { id: 'call-2', name: 'createTask', arguments: { objectiveId: 'portfolio', title: 'Trois projets' } };

function setup() {
  let snapshot: Snapshot = { value: READY, context: {} };
  const workflow = {
    startWorkFlow: vi.fn(async (id: string) => id),
    getState: vi.fn(() => snapshot),
    sendMessage: vi.fn(),
    // Comme la machine : accepter fait passer aussitôt à l'exécution de l'outil.
    respondToPermission: vi.fn((_: string, permission: boolean) => {
      if (permission) snapshot = { value: EXECUTING, context: {} };
    }),
  };
  const objectives = { loadObjectives: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      AkariWritesStore,
      { provide: SendMessageToAIWorkflow, useValue: workflow },
      { provide: ObjectiveStore, useValue: objectives },
      { provide: SessionStore, useValue: { currentUserId: signal('u1') } },
      { provide: GetConversationsQuery, useValue: { execute: vi.fn().mockResolvedValue({ id: 'c1', messages: [] }) } },
      { provide: AnnoncesStore, useValue: { annoncer: vi.fn(), signaler: vi.fn() } },
    ],
  });

  return {
    store: TestBed.inject(AkariWritesStore),
    workflow,
    objectives,
    setSnapshot: (next: Snapshot) => (snapshot = next),
  };
}

/** L'écran Akari : un ChatStore dans son propre injecteur, détruit quand on quitte l'écran. */
function openAkariScreen() {
  const injector = createEnvironmentInjector([ChatStore], TestBed.inject(EnvironmentInjector));
  return { chat: injector.get(ChatStore), leave: () => injector.destroy() };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

beforeEach(() => vi.useFakeTimers());

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
    const { store, objectives, setSnapshot } = setup();
    setSnapshot({ value: EXECUTING, context: {} });
    store.reloadAfterWrite('semi');
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();

    setSnapshot({ value: 'SendingCallResultToAI', context: {} });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledWith({ ownerId: 'u1' });

    await tick(5 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);
  });

  it('deux ajouts dans un même tour : l’arête se remplit après le premier, sans attendre la fin du tour', async () => {
    const { workflow, objectives, setSnapshot } = setup();
    // Akari demande une étape, puis un pas, dans le même tour.
    setSnapshot({ value: ASKING, context: { currentToolCall: STAGE_CALL } });
    const { chat } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();
    expect(chat.isAwaitingPermission()).toBe(true);
    chat.respondToPermission(true);
    expect(workflow.respondToPermission).toHaveBeenCalledWith('semi', true);
    await tick();
    expect(objectives.loadObjectives).not.toHaveBeenCalled();

    // L'étape est écrite ; Akari demande déjà le pas suivant : le tour n'est pas fini, l'arête se remplit.
    setSnapshot({ value: ASKING, context: { currentToolCall: TASK_CALL } });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(1);

    chat.respondToPermission(true);
    await tick();
    setSnapshot({ value: 'SendingCallResultToAI', context: {} });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(2);

    setSnapshot({ value: READY, context: {} });
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledTimes(2);
  });

  it('écran quitté avant la fin de l’écriture : les objectifs sont rechargés quand même', async () => {
    const { objectives, setSnapshot } = setup();
    setSnapshot({ value: ASKING, context: { currentToolCall: STAGE_CALL } });
    const { chat, leave } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();

    chat.respondToPermission(true);
    await tick();
    leave(); // « Voir l'arête », ou la matrice : ChatStore part avec l'écran

    setSnapshot({ value: 'SendingCallResultToAI', context: {} });
    await tick(AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).toHaveBeenCalledWith({ ownerId: 'u1' });
  });

  it('ne recharge rien quand la personne refuse', async () => {
    const { objectives, setSnapshot } = setup();
    setSnapshot({ value: ASKING, context: { currentToolCall: STAGE_CALL } });
    const { chat } = openAkariScreen();
    chat.initWorkflow('semi');
    await tick();

    chat.respondToPermission(false);
    setSnapshot({ value: READY, context: {} });
    await tick(3 * AKARI_WRITE_POLL_INTERVAL);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
  });
});
