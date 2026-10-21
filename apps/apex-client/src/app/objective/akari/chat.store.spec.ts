import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { GetConversationsQuery } from '@org/chat';
import { SendMessageToAIWorkflow, WORKFLOW_READY_FOR_NEW_MESSAGE } from '@org/ai-assistant';
import { SessionStore } from '../../../chore/stores/session.store';
import { ObjectiveStore } from '../../../chore/stores/objective.store';
import { AnnoncesStore } from '../../../chore/stores/annonces.store';
import { isTemporaryId } from '../../../chore/stores/utils/map-optimistique-id';
import { AKARI_REPLIED, AKARI_REPORTS, AKARI_STATUS, ChatStore } from './chat.store';

/*
 * La conversation avec Akari, workflow et requêtes simulés : historique, envoi optimiste,
 * interrogation toutes les secondes, demande d'accord, rechargement de l'arête, annonces.
 */

type Snapshot = { value: unknown; context: Record<string, unknown> } | undefined;

const READY = WORKFLOW_READY_FOR_NEW_MESSAGE;

function setup() {
  let snapshot: Snapshot = { value: READY, context: {} };
  const workflow = {
    startWorkFlow: vi.fn(async (id: string) => id),
    getState: vi.fn(() => snapshot),
    sendMessage: vi.fn(),
    respondToPermission: vi.fn(),
  };
  const conversations = {
    execute: vi.fn().mockResolvedValue({
      id: 'c1',
      messages: [
        { id: 'm2', sender: 'akari', content: 'Bonjour.', createdAt: new Date(2026, 9, 20, 10) },
        { id: 'm1', sender: 'u1', content: 'Salut.', createdAt: new Date(2026, 9, 20, 9) },
      ],
    }),
  };
  const objectives = { loadObjectives: vi.fn() };
  const annonces = { annoncer: vi.fn(), signaler: vi.fn() };

  TestBed.configureTestingModule({
    providers: [
      ChatStore,
      { provide: SessionStore, useValue: { currentUserId: signal('u1') } },
      { provide: GetConversationsQuery, useValue: conversations },
      { provide: SendMessageToAIWorkflow, useValue: workflow },
      { provide: ObjectiveStore, useValue: objectives },
      { provide: AnnoncesStore, useValue: annonces },
    ],
  });

  return {
    store: TestBed.inject(ChatStore),
    workflow,
    conversations,
    objectives,
    annonces,
    setSnapshot: (next: Snapshot) => (snapshot = next),
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
  it('charge les messages de l’objectif, dans l’ordre', async () => {
    const { store, conversations } = setup();
    expect(store.historyLoaded()).toBe(false);

    store.loadChatHistory({ objectifId: 'semi' });
    expect(store.isLoading()).toBe(true);
    await tick();

    expect(conversations.execute).toHaveBeenCalledWith('semi');
    expect(store.isLoading()).toBe(false);
    expect(store.historyLoaded()).toBe(true);
    expect(store.orderLatestMessages().map((m) => [m.id, m.sender])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant'],
    ]);
  });

  it('signale une conversation introuvable, sans message technique', async () => {
    const { store, conversations, annonces } = setup();
    conversations.execute.mockRejectedValue(new Error('network down'));
    store.loadChatHistory({ objectifId: 'semi' });
    await tick();
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.loadConversation);
    expect(store.historyLoaded()).toBe(true);
    expect(store.isLoading()).toBe(false);
  });
});

describe('ChatStore : le workflow', () => {
  it('reprend le workflow à l’ouverture, sans annoncer l’ancien dernier message', async () => {
    const { store, workflow, annonces, setSnapshot } = setup();
    setSnapshot({ value: READY, context: { lastRegisteredMessage: { id: 'm2', sender: 'akari', content: 'Bonjour.', createdAt: new Date() } } });

    store.initWorkflow('semi');
    await tick();
    expect(workflow.startWorkFlow).toHaveBeenCalledWith('semi');
    expect(store.canSendMessage()).toBe(true);
    expect(store.isStreaming()).toBe(false);
    expect(annonces.annoncer).not.toHaveBeenCalled();
  });

  it('signale un workflow qui ne démarre pas', async () => {
    const { store, workflow, annonces } = setup();
    workflow.startWorkFlow.mockRejectedValue(new Error('firestore'));
    store.initWorkflow('semi');
    await tick();
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.startConversation);
    expect(store.canSendMessage()).toBe(false);
  });

  it('envoie, montre ce que fait Akari, puis annonce sa réponse', async () => {
    const { store, workflow, annonces, setSnapshot } = setup();
    store.initWorkflow('semi');
    await tick();

    setSnapshot({ value: 'RegisteringUserMessageInConversation', context: {} });
    store.sendMessageToAi({ message: 'On commence ?', objectiveId: 'semi' });
    // Le message de la personne s'affiche tout de suite, avec un id temporaire.
    expect(store.messages()).toHaveLength(1);
    expect(isTemporaryId(store.messages()[0].id)).toBe(true);
    await tick();

    expect(workflow.sendMessage).toHaveBeenCalledWith('semi', 'u1', 'semi', 'On commence ?');
    expect(store.isStreaming()).toBe(true);
    expect(store.canSendMessage()).toBe(false);
    expect(store.processingStatus()).toBe(AKARI_STATUS.RegisteringUserMessageInConversation);

    // Le workflow a enregistré le message : l'id temporaire est remplacé.
    setSnapshot({ value: 'SendingPromptToAI', context: { lastRegisteredMessage: { id: 'm1', sender: 'u1', content: 'On commence ?', createdAt: new Date() } } });
    await tick(1000);
    expect(store.messages().map((m) => m.id)).toEqual(['m1']);
    expect(store.processingStatus()).toBe('Akari réfléchit…');

    // Une étape composée prend la phrase de son étape parente.
    setSnapshot({ value: { ExecutingAllTool: 'Executing' }, context: {} });
    await tick(1000);
    expect(store.processingStatus()).toBe('Akari regarde ton objectif…');

    setSnapshot({ value: READY, context: { lastRegisteredMessage: { id: 'm2', sender: 'akari', content: 'Voici 4 étapes.', createdAt: new Date() } } });
    await tick(1000);
    expect(store.messages().map((m) => [m.id, m.sender])).toEqual([
      ['m1', 'user'],
      ['m2', 'assistant'],
    ]);
    expect(store.isStreaming()).toBe(false);
    expect(store.canSendMessage()).toBe(true);
    expect(annonces.annoncer).toHaveBeenCalledWith(AKARI_REPLIED);

    // Les instantanés répétés n'ajoutent rien.
    await tick(3000);
    expect(store.messages()).toHaveLength(2);
  });

  it('demande l’accord, puis recharge l’arête après une étape acceptée', async () => {
    const { store, workflow, objectives, setSnapshot } = setup();
    store.initWorkflow('semi');
    await tick();

    setSnapshot({
      value: { ExecutingAllTool: 'WaitingForUserPermission' },
      context: { currentToolCall: { id: 'call-1', name: 'createSubObjective', arguments: { parentObjectiveId: 'semi', title: 'Portfolio' } } },
    });
    store.sendMessageToAi({ message: 'Propose-moi des étapes.', objectiveId: 'semi' });
    await tick();

    expect(store.isAwaitingPermission()).toBe(true);
    expect(store.isStreaming()).toBe(false);
    expect(store.permissionRequest()).toEqual({ kind: 'stage', title: 'Portfolio', parentId: 'semi' });

    setSnapshot({ value: 'SendingCallResultToAI', context: {} });
    store.respondToPermission(true);
    expect(workflow.respondToPermission).toHaveBeenCalledWith('semi', true);
    expect(store.isAwaitingPermission()).toBe(false);
    await tick();
    expect(objectives.loadObjectives).not.toHaveBeenCalled();

    setSnapshot({ value: READY, context: {} });
    await tick(1000);
    expect(objectives.loadObjectives).toHaveBeenCalledWith({ ownerId: 'u1' });
  });

  it('ne recharge rien quand la personne refuse', async () => {
    const { store, workflow, objectives, setSnapshot } = setup();
    store.initWorkflow('semi');
    await tick();
    setSnapshot({
      value: { ExecutingAllTool: 'WaitingForUserPermission' },
      context: { currentToolCall: { id: 'call-2', name: 'createTask', arguments: { objectiveId: 'endurance', title: 'Courir 10 km', importance: 3, urgency: 2 } } },
    });
    store.sendMessageToAi({ message: 'Un pas ?', objectiveId: 'semi' });
    await tick();
    expect(store.permissionRequest()).toEqual({ kind: 'task', title: 'Courir 10 km', objectiveId: 'endurance' });

    setSnapshot({ value: READY, context: {} });
    store.respondToPermission(false);
    expect(workflow.respondToPermission).toHaveBeenCalledWith('semi', false);
    await tick(1000);
    expect(objectives.loadObjectives).not.toHaveBeenCalled();
  });

  it('retire le message et signale quand le workflow ne répond pas à l’envoi', async () => {
    const { store, workflow, annonces } = setup();
    workflow.startWorkFlow.mockRejectedValue(new Error('firestore'));
    store.sendMessageToAi({ message: 'Bonjour', objectiveId: 'semi' });
    await tick();
    expect(store.messages()).toEqual([]);
    expect(store.isStreaming()).toBe(false);
    expect(annonces.signaler).toHaveBeenCalledWith(AKARI_REPORTS.startConversation);
  });
});
