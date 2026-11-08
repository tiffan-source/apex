import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ObjectivesApi } from '../api/objectives.api';
import { ApiError } from '../api/api-error';
import type { ObjectiveEntity, ObjectiveTreeNode, ObjectiveTreeResponse, TaskEntity } from '../api/api.models';
import { SessionStore } from './session.store';
import { AnnoncesStore } from './annonces.store';
import { ObjectiveStore } from './objective.store';
import { isTemporaryId } from './utils/map-optimistique-id';
import { FAILURE_REPORTS, SUCCESS_ANNOUNCEMENTS, voiceIssues } from '../constants/messages.constante';

/*
 * ObjectiveStore entier, API simulée : gestes rapprochés (rien ne se perd, rien ne s'écrase),
 * ids temporaires, retours en arrière, voix de tout ce qui est annoncé.
 */

/** Le message technique (anglais) d'une erreur de l'API : il ne doit jamais atteindre la personne. */
const DOMAIN_MESSAGE = 'Technical failure from the domain';

/** Le statut HTTP de chaque code d'erreur de l'API (apex-brain, http/api-error.ts). */
const STATUS_OF: Record<string, number> = {
  FAIL_TO_SAVE_OBJECTIVE: 500,
  FAIL_TO_SAVE_TASK: 500,
  OBJECTIVE_NOT_FOUND: 404,
  TASK_NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  TOO_MANY_REQUESTS: 429,
  UNAUTHENTICATED: 401,
  NETWORK_ERROR: 0,
};

/** Ce que la personne possède, à plat : `tree()` le rend tel que GET /v2/bff/objective-tree le sert. */
type Saved = { objectives: ObjectiveEntity[]; tasks: TaskEntity[] };

/** Un objectif ou une étape tel que le rend une commande. */
const objective = (id: string, title: string, parentObjectiveId: string | null = null, extra: Partial<ObjectiveEntity> = {}): ObjectiveEntity => ({
  id,
  title,
  description: '',
  why: '',
  dueDate: null,
  parentObjectiveId,
  done: false,
  ...extra,
});

/** Un pas tel que le rend une commande. */
const taskEntity = (id: string, title: string, objectiveId: string, importance = 3, urgency = 3, done = false): TaskEntity => ({
  id,
  title,
  importance,
  urgency,
  done,
  objectiveId,
});

const LOADED: Saved = {
  objectives: [objective('semi', 'Semi-marathon'), objective('endurance', 'Endurance', 'semi')],
  tasks: [taskEntity('t1', 'Courir 8 km', 'endurance', 4, 1), taskEntity('t2', 'Sortie longue', 'endurance', 1, 1, true)],
};

/** L'arbre de GET /v2/bff/objective-tree : chaque objectif avec ses pas et ses étapes. */
function tree(saved: Saved): ObjectiveTreeResponse {
  const node = (item: ObjectiveEntity): ObjectiveTreeNode => ({
    id: item.id,
    title: item.title,
    description: item.description,
    why: item.why,
    dueDate: item.dueDate,
    done: item.done,
    tasks: saved.tasks
      .filter((task) => task.objectiveId === item.id)
      .map((task) => ({ id: task.id, title: task.title, importance: task.importance, urgency: task.urgency, done: task.done })),
    subObjectives: saved.objectives.filter((child) => child.parentObjectiveId === item.id).map(node),
  });
  return { objectives: saved.objectives.filter((item) => item.parentObjectiveId === null).map(node) };
}

/** Ce que l'API rejette : une ApiError avec son code et son statut. */
const ko = (code: string) => new ApiError(code, STATUS_OF[code] ?? 500, DOMAIN_MESSAGE);

/** Laisse les promesses et la file d'écritures se vider. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve));
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

/** L'API simulée : une fonction par route qu'ObjectiveStore appelle. */
function createApiMock(loaded: Saved) {
  return {
    objectiveTree: vi.fn().mockResolvedValue(tree(structuredClone(loaded))),
    createObjective: vi.fn(),
    addSubObjective: vi.fn(),
    addTaskToObjective: vi.fn(),
    renameObjective: vi.fn(),
    clarifyObjective: vi.fn(),
    setObjectiveDeadline: vi.fn(),
    removeObjectiveDeadline: vi.fn(),
    deleteObjective: vi.fn(),
    renameTask: vi.fn(),
    reprioritizeTask: vi.fn(),
    moveTask: vi.fn(),
    completeTask: vi.fn(),
    reopenTask: vi.fn(),
    deleteTask: vi.fn(),
  };
}

/**
 * Un ObjectiveStore chargé avec `loaded`, son API simulée et le LiveAnnouncer espionné.
 * Avec `firstLoad`, le premier chargement attend cette promesse (et `loaded` sert aux suivants).
 */
async function setup(
  loaded: Saved = LOADED,
  firstLoad?: Promise<ObjectiveTreeResponse>,
  session = { currentUserId: signal<string | null>('lea'), isAuthenticated: signal(true) },
) {
  const api = createApiMock(loaded);
  if (firstLoad) api.objectiveTree.mockReturnValueOnce(firstLoad);
  const announce = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      ObjectiveStore,
      provideRouter([{ path: '**', children: [] }]),
      { provide: ObjectivesApi, useValue: api },
      { provide: SessionStore, useValue: session },
      { provide: LiveAnnouncer, useValue: { announce } },
    ],
  });
  const store = TestBed.inject(ObjectiveStore);
  const annonces = TestBed.inject(AnnoncesStore);
  TestBed.tick();
  await settle();
  // Après le premier chargement, la base rend ce qui est enregistré : ici, ce que l'écran montre.
  api.objectiveTree.mockImplementation(async () => tree(savedState(store)));
  // Une commande acceptée rend l'élément changé, comme l'écran le montre.
  const savedTask = (id: string): TaskEntity => {
    const found = store.tasks().find((item) => item.id === id);
    if (!found) throw ko('TASK_NOT_FOUND');
    return { ...found };
  };
  const savedObjective = (id: string): ObjectiveEntity => {
    const found = savedState(store).objectives.find((item) => item.id === id);
    if (!found) throw ko('OBJECTIVE_NOT_FOUND');
    return found;
  };
  api.renameTask.mockImplementation(async (id: string, title: string) => ({ ...savedTask(id), title }));
  api.reprioritizeTask.mockImplementation(async (id: string, importance: number, urgency: number) => ({ ...savedTask(id), importance, urgency }));
  api.moveTask.mockImplementation(async (id: string, objectiveId: string) => ({ ...savedTask(id), objectiveId }));
  api.completeTask.mockImplementation(async (id: string) => ({ ...savedTask(id), done: true }));
  api.reopenTask.mockImplementation(async (id: string) => ({ ...savedTask(id), done: false }));
  api.renameObjective.mockImplementation(async (id: string, title: string) => ({ ...savedObjective(id), title }));
  api.clarifyObjective.mockImplementation(async (id: string, body: { description?: string; why?: string }) => ({ ...savedObjective(id), ...body }));
  api.setObjectiveDeadline.mockImplementation(async (id: string, dueDate: string) => ({ ...savedObjective(id), dueDate }));
  return { store, annonces, announce, api, session };
}

/** Ce que la base contient : l'état du store, sans ce qui n'est pas encore enregistré. */
function savedState(store: InstanceType<typeof ObjectiveStore>): Saved {
  return {
    objectives: store
      .objectives()
      .filter((item) => !isTemporaryId(item.id))
      .map(({ id, title, description, why, dueDate, parentId, done }) => ({
        id,
        title,
        description,
        why,
        dueDate: dueDate || null,
        parentObjectiveId: parentId,
        done,
      })),
    tasks: store.tasks().filter((item) => !isTemporaryId(item.id)),
  };
}

/** Les ids temporaires qui restent dans l'état. */
function temporaryIdsOf(store: Awaited<ReturnType<typeof setup>>['store']): string[] {
  return [...store.objectives().map((item) => item.id), ...store.tasks().map((item) => item.id)].filter(isTemporaryId);
}

beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));
afterEach(() => vi.restoreAllMocks());

describe('ObjectiveStore', () => {
  let s: Awaited<ReturnType<typeof setup>>;
  beforeEach(async () => (s = await setup()));

  const task = (id: string) => s.store.tasks().find((item) => item.id === id);
  const objectiveOf = (id: string) => s.store.objectives().find((item) => item.id === id);
  const temporaryIds = () => temporaryIdsOf(s.store);
  const reads = () => s.api.objectiveTree.mock.calls.length;

  it('charge l’arbre des objectifs de la personne connectée, à plat', () => {
    expect(s.api.objectiveTree).toHaveBeenCalledTimes(1);
    expect(s.store.objectives().map((item) => [item.id, item.parentId])).toEqual([['semi', null], ['endurance', 'semi']]);
    expect(s.store.tasks().map((item) => [item.id, item.objectiveId])).toEqual([['t1', 'endurance'], ['t2', 'endurance']]);
    expect(s.store.objectiveCards().map((card) => card.id)).toEqual(['semi']);
  });

  describe('ce qui part vers l’API', () => {
    it('chaque geste envoie ses commandes, sans l’id de la personne (l’API la reconnaît à son jeton)', async () => {
      s.api.createObjective.mockResolvedValue(objective('guitare', 'Guitare'));
      s.api.addSubObjective.mockResolvedValue(objective('accords', 'Accords', 'semi'));
      s.api.addTaskToObjective.mockResolvedValue(taskEntity('p1', 'Do, ré, mi', 'endurance', 3, 2));
      const dueDate = new Date(2027, 4, 1);

      s.store.createObjective({ title: 'Guitare', why: 'Jouer pour ma sœur', dueDate });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Do, ré, mi', importance: 3, urgency: 2 } });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai', description: 'Le 4 mai', dueDate });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      await settle();

      expect(s.api.createObjective).toHaveBeenCalledWith({ title: 'Guitare', description: undefined, why: 'Jouer pour ma sœur', dueDate: dueDate.toISOString() });
      expect(s.api.addSubObjective).toHaveBeenCalledWith('semi', { title: 'Accords' });
      expect(s.api.addTaskToObjective).toHaveBeenCalledWith('endurance', { title: 'Do, ré, mi', importance: 3, urgency: 2 });
      // Seulement ce qui a changé : le pourquoi, absent, ne part pas.
      expect(s.api.renameObjective).toHaveBeenCalledWith('semi', 'Semi en mai');
      expect(s.api.clarifyObjective).toHaveBeenCalledWith('semi', { description: 'Le 4 mai' });
      expect(s.api.setObjectiveDeadline).toHaveBeenCalledWith('semi', dueDate.toISOString());
      expect(s.api.renameTask).toHaveBeenCalledWith('t1', 'Courir 10 km');
      expect(s.api.reprioritizeTask).not.toHaveBeenCalled();
      expect(s.api.moveTask).not.toHaveBeenCalled();
      expect(s.api.reopenTask).toHaveBeenCalledWith('t2');
      const sent = JSON.stringify(Object.values(s.api).flatMap((route) => route.mock.calls));
      expect(sent).not.toContain('lea');
      expect(sent).not.toContain('ownerId');
    });

    it('une description vidée part vide dans clarifyObjective ; rien d’inchangé ne part', async () => {
      TestBed.resetTestingModule();
      const loaded = structuredClone(LOADED);
      loaded.objectives[0] = { ...loaded.objectives[0], description: 'Le 4 mai', why: 'Finir' };
      const t = await setup(loaded);

      t.store.editObjective({ id: 'semi', title: 'Semi-marathon', description: '', why: 'Finir' });
      t.store.editObjective({ id: 'endurance', title: 'Endurance' });
      await settle();

      expect(t.api.clarifyObjective.mock.calls).toEqual([['semi', { description: '' }]]);
      expect(t.api.renameObjective).not.toHaveBeenCalled();
      expect(t.api.setObjectiveDeadline).not.toHaveBeenCalled();
    });

    it('un pas modifié de tout : renommer, reprioriser, puis déplacer, dans cet ordre', async () => {
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 2, urgency: 5, objectiveId: 'semi' } });
      await settle();

      expect(s.api.renameTask).toHaveBeenCalledWith('t1', 'Courir 10 km');
      expect(s.api.reprioritizeTask).toHaveBeenCalledWith('t1', 2, 5);
      expect(s.api.moveTask).toHaveBeenCalledWith('t1', 'semi');
      expect(s.api.renameTask.mock.invocationCallOrder[0]).toBeLessThan(s.api.reprioritizeTask.mock.invocationCallOrder[0]);
      expect(s.api.reprioritizeTask.mock.invocationCallOrder[0]).toBeLessThan(s.api.moveTask.mock.invocationCallOrder[0]);
      expect(task('t1')).toMatchObject({ title: 'Courir 10 km', importance: 2, urgency: 5, objectiveId: 'semi' });
      expect(s.announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.taskSaved, 'polite');
      expect(s.announce).toHaveBeenCalledTimes(1);
    });

    it('sans session, aucun geste ne part et rien ne reste en attente', async () => {
      TestBed.resetTestingModule();
      const t = await setup();
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      t.session.isAuthenticated.set(false);

      t.store.createObjective({ title: 'Guitare' });
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      t.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 3, objectiveId: 'endurance' } });
      t.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(t.api.createObjective).not.toHaveBeenCalled();
      expect(t.api.completeTask).not.toHaveBeenCalled();
      expect(t.store.tasks().find((item) => item.id === 't1')?.done).toBe(false);
      expect(t.api.addTaskToObjective).not.toHaveBeenCalled();
      expect(t.api.reprioritizeTask).not.toHaveBeenCalled();
      expect(temporaryIdsOf(t.store)).toEqual([]);
      expect(t.store.isPending()).toBe(false);
    });

    it('un texte refusé par l’API (trop long) est signalé comme tel, et l’ajout optimiste est retiré', async () => {
      s.api.addTaskToObjective.mockRejectedValueOnce(ko('VALIDATION_ERROR'));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'x'.repeat(201), importance: 3, urgency: 3 } });
      await settle();

      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.textTooLong);
    });

    it('une modification garde à l’écran ce qu’elle laisse inchangé (un champ absent), comme l’API', async () => {
      TestBed.resetTestingModule();
      const loaded = structuredClone(LOADED);
      loaded.objectives[1] = { ...loaded.objectives[1], description: 'Tenir une heure', why: 'Finir le semi', dueDate: '2027-04-01T00:00:00.000Z' };
      const t = await setup(loaded);
      // Les réponses n'arrivent pas : on regarde l'écran optimiste
      t.api.renameObjective.mockReturnValue(new Promise(() => undefined));
      t.api.clarifyObjective.mockReturnValue(new Promise(() => undefined));

      // La feuille d'une étape ne touche pas au pourquoi ; sans date, l'échéance reste.
      t.store.editObjective({ id: 'endurance', title: 'Fond', description: '' });
      await settle();

      expect(t.store.objectives().find((item) => item.id === 'endurance')).toMatchObject({
        title: 'Fond',
        description: '',
        why: 'Finir le semi',
        dueDate: '2027-04-01T00:00:00.000Z',
      });
      expect(t.api.setObjectiveDeadline).not.toHaveBeenCalled();
    });
  });

  describe('ce que l’API rend remplace l’élément, sans relire l’arbre', () => {
    it('un pas ajouté, renommé, coché, et un objectif modifié prennent ce que l’API rend', async () => {
      s.api.addTaskToObjective.mockResolvedValue(taskEntity('p1', 'Fractionné', 'endurance', 3, 2));
      s.api.renameTask.mockResolvedValue(taskEntity('t1', 'Courir 9 km', 'endurance', 4, 1));
      s.api.renameObjective.mockResolvedValue(objective('semi', 'Semi de mai'));
      const before = reads();

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Fractionné ', importance: 3, urgency: 2 } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 9 km ', objectiveId: 'endurance', importance: 4, urgency: 1 } });
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      await settle();

      expect(task('p1')?.title).toBe('Fractionné');
      expect(task('t1')).toMatchObject({ title: 'Courir 9 km', done: true });
      expect(objectiveOf('semi')?.title).toBe('Semi de mai');
      expect(reads()).toBe(before);
    });

    it('une étape et un objectif créés prennent ce que l’API rend', async () => {
      s.api.addSubObjective.mockResolvedValue(objective('accords', 'Accords', 'semi'));
      s.api.createObjective.mockResolvedValue(objective('guitare', 'Guitare', null, { dueDate: '2027-05-01T00:00:00.000Z' }));
      const before = reads();

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords ' });
      s.store.createObjective({ title: 'Guitare', dueDate: new Date('2027-05-01T00:00:00.000Z') });
      await settle();

      expect(objectiveOf('accords')).toMatchObject({ title: 'Accords', parentId: 'semi' });
      expect(objectiveOf('guitare')).toMatchObject({ title: 'Guitare', dueDate: '2027-05-01T00:00:00.000Z', parentId: null });
      expect(reads()).toBe(before);
    });

    it('un geste plus récent n’est pas écrasé par la réponse d’un plus ancien', async () => {
      const renamed = deferred<TaskEntity>();
      s.api.renameTask.mockReturnValueOnce(renamed.promise);

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 9 km', objectiveId: 'endurance', importance: 4, urgency: 1 } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 12 km', objectiveId: 'endurance', importance: 4, urgency: 1 } });
      renamed.resolve(taskEntity('t1', 'Courir 9 km', 'endurance', 4, 1));
      await settle();

      expect(task('t1')?.title).toBe('Courir 12 km');
    });
  });

  describe('une commande refusée revient en arrière seule', () => {
    it('un déplacement refusé ramène le pas dans son étape, son nouveau nom reste', async () => {
      s.api.moveTask.mockRejectedValueOnce(ko('TOO_MANY_REQUESTS'));

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'semi' } });
      await settle();

      expect(task('t1')).toMatchObject({ title: 'Courir 10 km', objectiveId: 'endurance' });
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.tooManyRequests);
      expect(s.announce).not.toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.taskSaved, 'polite');
    });

    it('une échéance refusée revient, le nouveau nom reste', async () => {
      s.api.setObjectiveDeadline.mockRejectedValueOnce(ko('VALIDATION_ERROR'));

      s.store.editObjective({ id: 'semi', title: 'Semi en mai', dueDate: new Date('2027-05-04T00:00:00.000Z') });
      await settle();

      expect(objectiveOf('semi')).toMatchObject({ title: 'Semi en mai', dueDate: '' });
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.textTooLong);
    });

    it('un refus net ne relit rien', async () => {
      s.api.completeTask.mockRejectedValue(ko('TOO_MANY_REQUESTS'));
      const before = reads();

      s.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(reads()).toBe(before);
      expect(task('t1')?.done).toBe(false);
    });

    it('sans réponse claire, l’API a pu faire le geste : l’arbre est relu', async () => {
      s.api.completeTask.mockRejectedValue(ko('NETWORK_ERROR'));
      const before = reads();

      s.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(reads()).toBe(before + 1);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.toggleTask);
    });

    it('deux commandes d’un geste sans réponse claire : l’arbre n’est relu qu’une fois', async () => {
      s.api.renameTask.mockRejectedValue(ko('NETWORK_ERROR'));
      s.api.reprioritizeTask.mockRejectedValue(ko('NETWORK_ERROR'));
      const before = reads();

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 1, urgency: 1, objectiveId: 'endurance' } });
      await settle();

      expect(reads()).toBe(before + 1);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editTask);
    });

    it('un pas que l’API ne connaît plus (404) quitte l’écran, sans relecture', async () => {
      s.api.completeTask.mockRejectedValue(ko('TASK_NOT_FOUND'));
      const before = reads();

      s.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(task('t1')).toBeUndefined();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.taskNotFound);
      expect(reads()).toBe(before);
    });

    it('une étape que l’API ne connaît plus (404) quitte l’écran avec ses pas', async () => {
      s.api.renameObjective.mockRejectedValue(ko('OBJECTIVE_NOT_FOUND'));

      s.store.editObjective({ id: 'endurance', title: 'Fond' });
      await settle();

      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi']);
      expect(s.store.tasks()).toEqual([]);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.objectiveNotFound);
    });

    it('un pas déplacé vers une étape qui n’existe plus reste où il était, et l’étape quitte l’écran', async () => {
      s.api.addSubObjective.mockResolvedValueOnce(objective('portfolio', 'Portfolio', 'semi'));
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      await settle();
      s.api.moveTask.mockRejectedValueOnce(ko('OBJECTIVE_NOT_FOUND'));

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 1, objectiveId: 'portfolio' } });
      await settle();

      expect(task('t1')?.objectiveId).toBe('endurance');
      expect(objectiveOf('portfolio')).toBeUndefined();
    });
  });

  describe('gestes rapprochés : aucune réponse ne se perd', () => {
    it('deux pas ajoutés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.api.addTaskToObjective
        .mockResolvedValueOnce(taskEntity('p1', 'Un', 'endurance'))
        .mockResolvedValueOnce(taskEntity('p2', 'Deux', 'endurance'));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Deux', importance: 3, urgency: 3 } });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1', 'p2']);
      expect(s.announce).toHaveBeenCalledTimes(2);
    });

    it('deux étapes ajoutées coup sur coup reçoivent toutes deux leur id définitif', async () => {
      s.api.addSubObjective
        .mockResolvedValueOnce(objective('e1', 'Une', 'semi'))
        .mockResolvedValueOnce(objective('e2', 'Deux', 'semi'));

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Une' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.stageOptions('semi').map((option) => option.valeur)).toEqual(['endurance', 'e1', 'e2']);
    });

    it('deux objectifs créés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.api.createObjective.mockResolvedValueOnce(objective('o1', 'Un')).mockResolvedValueOnce(objective('o2', 'Deux'));

      s.store.createObjective({ title: 'Un' });
      s.store.createObjective({ title: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.objectiveOptions().map((option) => option.valeur)).toEqual(['semi', 'o1', 'o2']);
    });

    it('le retour en arrière d’un pas modifié a lieu même si un autre pas est modifié juste après', async () => {
      s.api.renameTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't2', input: { title: 'Sortie de 2 h', importance: 1, urgency: 1, objectiveId: 'endurance' } });
      await settle();

      expect(task('t1')?.title).toBe('Courir 8 km');
      expect(task('t2')?.title).toBe('Sortie de 2 h');
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editTask);
    });

    it('le retour en arrière d’un objectif modifié a lieu même si un autre est modifié juste après', async () => {
      s.api.renameObjective.mockRejectedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));

      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      s.store.editObjective({ id: 'endurance', title: 'Fond' });
      await settle();

      expect(s.store.objectives().map((item) => item.title)).toEqual(['Semi-marathon', 'Fond']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editObjective);
    });
  });

  describe('les écritures partent une par une, dans l’ordre des gestes', () => {
    it('le second geste attend la réponse du premier', async () => {
      const first = deferred<TaskEntity>();
      s.api.completeTask.mockReturnValueOnce(first.promise);

      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't1', done: false });
      await settle();
      expect(s.api.completeTask).toHaveBeenCalledTimes(1);
      expect(s.api.reopenTask).not.toHaveBeenCalled();
      expect(task('t1')?.done).toBe(false);

      first.resolve(taskEntity('t1', 'Courir 8 km', 'endurance', 4, 1, true));
      await settle();
      expect(s.api.reopenTask).toHaveBeenCalledWith('t1');
      expect(task('t1')?.done).toBe(false);
    });

    it('un retour en arrière n’écrase pas un geste plus récent', async () => {
      s.api.reprioritizeTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 3, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 2, urgency: 3, objectiveId: 'endurance' } });
      await settle();

      expect(task('t1')).toMatchObject({ importance: 2, urgency: 3 });
    });

    it('un pas recoché après un échec reste coché', async () => {
      s.api.reopenTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.updateTaskDone({ taskId: 't2', done: false });
      s.store.updateTaskDone({ taskId: 't2', done: true });
      await settle();

      expect(task('t2')?.done).toBe(true);
    });

    it('un geste en attente ne part pas si une autre personne s’est connectée entre-temps (un autre onglet)', async () => {
      const first = deferred<TaskEntity>();
      s.api.completeTask.mockReturnValueOnce(first.promise);
      s.api.addTaskToObjective.mockResolvedValue(taskEntity('p9', 'Un', 'endurance'));

      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      await settle();
      s.session.currentUserId.set('noe');
      first.resolve(taskEntity('t1', 'Courir 8 km', 'endurance', 4, 1, true));
      await settle();

      // Le pas de Léa n'est pas écrit dans le compte de Noé.
      expect(s.api.addTaskToObjective).not.toHaveBeenCalled();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.sessionEnded);
    });
  });

  describe('aucun geste ne vise un élément pas encore enregistré', () => {
    it('sur une étape, un objectif ou un pas encore en création, rien ne change à l’écran et rien ne part', async () => {
      const createdObjective = deferred<ObjectiveEntity>();
      const createdStage = deferred<ObjectiveEntity>();
      const createdTask = deferred<TaskEntity>();
      s.api.createObjective.mockReturnValue(createdObjective.promise);
      s.api.addSubObjective.mockReturnValue(createdStage.promise);
      s.api.addTaskToObjective.mockReturnValue(createdTask.promise);
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);

      s.store.createObjective({ title: 'Guitare' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      const objectiveId = s.store.objectiveOptions()[1].valeur;
      const stageId = s.store.stageOptions('semi')[1].valeur;
      const taskId = s.store.tasks()[2].id;
      expect([objectiveId, stageId, taskId].every(isTemporaryId)).toBe(true);
      const before = { objectives: s.store.objectives(), tasks: s.store.tasks() };

      s.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: stageId, task: { title: 'Trois projets', importance: 3, urgency: 2 } });
      s.store.editObjective({ id: stageId, title: 'Portfolio en ligne' });
      s.store.updateTaskDone({ taskId, done: true });
      s.store.editTask({ taskId, input: { title: 'Deux', importance: 3, urgency: 3, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 1, objectiveId: stageId } });
      s.store.deleteTask(taskId);
      s.store.deleteObjective(stageId);
      // Une étape enregistrée emporterait un pas encore en création : elle attend.
      s.store.deleteObjective('endurance');
      await settle();

      expect(s.store.objectives()).toEqual(before.objectives);
      expect(s.store.tasks()).toEqual(before.tasks);

      // Les créations aboutissent : seules elles sont parties.
      createdObjective.resolve(objective('guitare', 'Guitare'));
      createdStage.resolve(objective('portfolio', 'Portfolio', 'semi'));
      createdTask.resolve(taskEntity('p1', 'Un', 'endurance'));
      await settle();
      expect(s.api.createObjective).toHaveBeenCalledTimes(1);
      expect(s.api.addSubObjective).toHaveBeenCalledTimes(1);
      expect(s.api.addTaskToObjective).toHaveBeenCalledTimes(1);
      for (const route of ['renameObjective', 'completeTask', 'renameTask', 'moveTask', 'deleteTask', 'deleteObjective'] as const) {
        expect(s.api[route]).not.toHaveBeenCalled();
      }
      expect(s.annonces.signalement()).toBeNull();
    });

    it('une fois enregistré, il reçoit les gestes, avec son id définitif', async () => {
      s.api.addSubObjective.mockResolvedValueOnce(objective('portfolio', 'Portfolio', 'semi'));
      s.api.addTaskToObjective.mockResolvedValueOnce(taskEntity('p1', 'Trois projets', 'portfolio', 3, 2));

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      await settle();
      expect(s.store.stageOptions('semi')[1].valeur).toBe('portfolio');

      s.store.addTaskToObjective({ objectiveId: 'portfolio', task: { title: 'Trois projets', importance: 3, urgency: 2 } });
      await settle();
      s.store.updateTaskDone({ taskId: 'p1', done: true });
      await settle();

      expect(s.api.addTaskToObjective).toHaveBeenCalledWith('portfolio', expect.objectContaining({ title: 'Trois projets' }));
      expect(s.api.completeTask).toHaveBeenCalledWith('p1');
      expect(s.store.objectiveDetail('semi')?.stages[1].tasks.map((item) => item.id)).toEqual(['p1']);
      expect(temporaryIds()).toEqual([]);
    });

    it('un pas dont l’ajout n’aboutit pas quitte l’écran, et son signalement reste', async () => {
      s.api.addTaskToObjective.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      await settle();

      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.addTask);
    });
  });

  describe('« Je m’y engage » : le store mène la suite', () => {
    it('pendant l’enregistrement, creatingObjective est vrai ; enregistré, Akari s’ouvre sur l’objectif', async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/objectifs/nouveau');
      const created = deferred<ObjectiveEntity>();
      s.api.createObjective.mockReturnValueOnce(created.promise);

      s.store.createObjective({ title: 'Guitare' });
      expect(s.store.creatingObjective()).toBe(true);
      created.resolve(objective('guitare', 'Guitare'));
      await settle();

      expect(s.store.creatingObjective()).toBe(false);
      expect(router.url).toBe('/objectifs/guitare/akari');
    });

    it('la personne est partie ailleurs entre-temps : elle y reste', async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/objectifs/nouveau');
      const created = deferred<ObjectiveEntity>();
      s.api.createObjective.mockReturnValueOnce(created.promise);

      s.store.createObjective({ title: 'Guitare' });
      await router.navigateByUrl('/objectifs/semi');
      created.resolve(objective('guitare', 'Guitare'));
      await settle();

      expect(router.url).toBe('/objectifs/semi');
      expect(s.store.objectiveOptions().map((option) => option.valeur)).toContain('guitare');
    });

    it('pas enregistré : rien ne s’ouvre, creatingObjective revient à faux et la note le dit', async () => {
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/objectifs/nouveau');
      s.api.createObjective.mockRejectedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));

      s.store.createObjective({ title: 'Guitare' });
      await settle();

      expect(s.store.creatingObjective()).toBe(false);
      expect(router.url).toBe('/objectifs/nouveau');
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.createObjective);
    });
  });

  describe('objectivesLoaded : la mémoire du chargement', () => {
    it('vrai une fois chargé ; une écriture refusée ne touche ni à lui, ni au statut du chargement', async () => {
      expect(s.store.objectivesLoaded()).toBe(true);
      s.api.createObjective.mockRejectedValueOnce(ko('VALIDATION_ERROR'));
      s.store.createObjective({ title: 'Guitare' });
      expect(s.store.isPending()).toBe(false);
      await settle();
      expect(s.store.error()).toBeNull();
      expect(s.store.objectivesLoaded()).toBe(true);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.textTooLong);
    });

    it('faux pendant le premier chargement, et après un chargement qui n’aboutit pas', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectiveTreeResponse>();
      const t = await setup(LOADED, load.promise);
      expect(t.store.isPending()).toBe(true);
      expect(t.store.objectivesLoaded()).toBe(false);

      load.resolve(tree(LOADED));
      await settle();
      expect(t.store.objectivesLoaded()).toBe(true);

      t.store.clearObjectives(); // déconnexion
      expect(t.store.objectivesLoaded()).toBe(false);
      t.api.objectiveTree.mockRejectedValueOnce(new Error('réseau'));
      t.store.loadObjectives();
      await settle();
      expect(t.store.objectivesLoaded()).toBe(false);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });

  describe('le chargement garde les créations en vol', () => {
    it('le premier chargement garde l’objectif et le pas encore optimistes', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectiveTreeResponse>();
      const t = await setup(LOADED, load.promise);
      const created = deferred<ObjectiveEntity>();
      t.api.createObjective.mockReturnValueOnce(created.promise);
      t.api.addTaskToObjective.mockResolvedValueOnce(taskEntity('p1', 'Fractionné', 'endurance', 3, 2));

      // « Je m'y engage » et un pas ajouté à une étape enregistrée, avant la fin du premier chargement
      t.store.createObjective({ title: 'Guitare' });
      const objectiveId = t.store.objectiveOptions()[0].valeur;
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Fractionné', importance: 3, urgency: 2 } });
      await settle();
      // Les écritures attendent le chargement : elles partent après sa lecture de la base
      expect(t.api.createObjective).not.toHaveBeenCalled();

      load.resolve(tree(LOADED));
      await settle();
      // Le chargement a remplacé l'état : les éléments optimistes sont toujours là, après les éléments chargés
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', objectiveId]);
      expect(t.store.tasks().map((item) => item.title)).toEqual(['Courir 8 km', 'Sortie longue', 'Fractionné']);
      expect(t.api.createObjective).toHaveBeenCalledTimes(1);

      created.resolve(objective('guitare', 'Guitare'));
      await settle();
      expect(temporaryIdsOf(t.store)).toEqual([]);
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare']);
      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1']);
      expect(t.store.creatingObjective()).toBe(false);
    });

    it('un objectif créé juste avant un rechargement n’est ni perdu ni en double', async () => {
      let saved = false;
      s.api.createObjective.mockImplementationOnce(async () => {
        saved = true;
        return objective('guitare', 'Guitare');
      });
      // La base, lue après l'écriture, contient le nouvel objectif
      s.api.objectiveTree.mockImplementationOnce(async () =>
        tree({ objectives: [...LOADED.objectives, ...(saved ? [objective('guitare', 'Guitare')] : [])], tasks: LOADED.tasks }),
      );

      s.store.createObjective({ title: 'Guitare' });
      s.store.loadObjectives();
      await settle();

      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare']);
      expect(s.api.createObjective.mock.invocationCallOrder[0]).toBeLessThan(s.api.objectiveTree.mock.invocationCallOrder[1]);
    });

    it('un pas coché pendant un rechargement reste coché : la base est relue après son écriture', async () => {
      // Une base simulée : ce que la coche enregistre, la lecture suivante le rend.
      let t1DoneInDb = false;
      s.api.completeTask.mockImplementation(async () => {
        t1DoneInDb = true;
        return taskEntity('t1', 'Courir 8 km', 'endurance', 4, 1, true);
      });
      s.api.objectiveTree.mockImplementation(async () =>
        tree({ ...LOADED, tasks: LOADED.tasks.map((item) => (item.id === 't1' ? { ...item, done: t1DoneInDb } : item)) }),
      );
      const reload = deferred<ObjectiveTreeResponse>();
      s.api.objectiveTree.mockReturnValueOnce(reload.promise);

      // Le rechargement de fin de tour d'Akari lit la base ; la personne coche t1 pendant ce temps.
      s.store.loadObjectives();
      await settle();
      s.store.updateTaskDone({ taskId: 't1', done: true });
      expect(task('t1')?.done).toBe(true);

      // La lecture, faite avant l'écriture de la coche, rend t1 à faire : elle n'efface pas la coche.
      reload.resolve(tree(LOADED));
      await settle();

      expect(s.api.completeTask).toHaveBeenCalledWith('t1');
      expect(t1DoneInDb).toBe(true);
      expect(task('t1')?.done).toBe(true);
      // Le premier chargement, le rechargement et sa relecture ; la coche acceptée ne relit rien.
      expect(s.api.objectiveTree).toHaveBeenCalledTimes(3);
      expect(s.store.isPending()).toBe(false);
      expect(s.store.error()).toBeNull();
    });

    it('un rechargement sans geste pendant sa lecture ne relit pas la base', async () => {
      s.store.loadObjectives();
      await settle();
      expect(s.api.objectiveTree).toHaveBeenCalledTimes(2);
    });

    it('un pas dont l’ajout n’aboutit pas après le chargement disparaît quand même', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectiveTreeResponse>();
      const t = await setup(LOADED, load.promise);
      t.api.addTaskToObjective.mockRejectedValueOnce(ko('VALIDATION_ERROR'));

      load.resolve(tree(LOADED));
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 2 } });
      await settle();

      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.textTooLong);
    });
  });

  describe('fait ou non fait : c’est l’API qui le dit', () => {
    const stageDone = () => s.store.objectiveDetail('semi')?.stages[0].done;

    it('un pas coché change tout de suite, et l’étape reste comme l’API l’a dite : rien n’est relu ni déduit', async () => {
      const before = reads();

      s.store.updateTaskDone({ taskId: 't1', done: true });
      expect(task('t1')?.done).toBe(true);
      await settle();

      expect(s.store.tasks().every((item) => item.done)).toBe(true);
      expect(stageDone()).toBe(false);
      expect(reads()).toBe(before);
    });

    it('une étape est faite quand l’arbre la rend faite', async () => {
      s.api.objectiveTree.mockResolvedValueOnce(
        tree({ objectives: LOADED.objectives.map((item) => ({ ...item, done: true })), tasks: LOADED.tasks }),
      );

      s.store.loadObjectives();
      await settle();

      expect(stageDone()).toBe(true);
      expect(s.store.objectiveCards()).toEqual([]);
      expect(s.store.accomplishedObjectives().map((card) => card.id)).toEqual(['semi']);
    });

    it('ne relit pas après un pas ajouté, ni après un pas modifié', async () => {
      s.api.addTaskToObjective.mockResolvedValue(taskEntity('p1', 'Fractionné', 'endurance', 3, 2));
      const before = reads();

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Fractionné', importance: 3, urgency: 2 } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 9 km', objectiveId: 'endurance', importance: 4, urgency: 1 } });
      await settle();

      expect(reads()).toBe(before);
    });
  });

  describe('effacer', () => {
    const ids = () => ({
      objectives: s.store.objectives().map((item) => item.id),
      tasks: s.store.tasks().map((item) => item.id),
    });

    it('un pas quitte l’état tout de suite et part par DELETE, sans relecture', async () => {
      s.api.deleteTask.mockResolvedValue(null);
      const before = reads();
      const announced = s.announce.mock.calls.length;

      s.store.deleteTask('t1');
      expect(task('t1')).toBeUndefined();
      await settle();

      expect(s.api.deleteTask).toHaveBeenCalledWith('t1');
      expect(reads()).toBe(before);
      expect(ids().tasks).toEqual(['t2']);
      // Sa trace l'a déjà dit à l'écran : rien de plus à annoncer.
      expect(s.announce.mock.calls.length).toBe(announced);
    });

    it('un pas déjà effacé côté serveur (404) l’est : rien à signaler', async () => {
      s.api.deleteTask.mockRejectedValue(ko('TASK_NOT_FOUND'));
      s.store.deleteTask('t1');
      await settle();
      expect(ids().tasks).toEqual(['t2']);
      expect(s.annonces.signalement()).toBeNull();
    });

    it('un pas qui n’est pas effacé faute de réponse revient à sa place, c’est signalé, et la base est relue', async () => {
      s.api.deleteTask.mockRejectedValue(ko('NETWORK_ERROR'));
      const before = reads();
      s.store.deleteTask('t1');
      await settle();
      expect(ids().tasks).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.eraseTask);
      // L'API dit ce qui est vrai : sa réponse a pu se perdre après l'effacement.
      expect(reads()).toBe(before + 1);
    });

    it('un pas dont l’effacement est refusé revient, sans relecture', async () => {
      s.api.deleteTask.mockRejectedValue(ko('TOO_MANY_REQUESTS'));
      const before = reads();
      s.store.deleteTask('t1');
      await settle();
      expect(ids().tasks).toEqual(['t1', 't2']);
      expect(reads()).toBe(before);
    });

    it('un pas refusé dont l’étape est partie entre-temps ne revient pas, et ne dit rien : il part avec elle', async () => {
      s.api.deleteTask.mockRejectedValue(ko('NETWORK_ERROR'));
      s.api.deleteObjective.mockResolvedValue(null);
      s.store.deleteTask('t1');
      s.store.deleteObjective('endurance');
      await settle();
      expect(ids()).toEqual({ objectives: ['semi'], tasks: [] });
      expect(s.annonces.signalement()).toBeNull();
    });

    it('un pas qui n’est plus là est ignoré : une trace peut le redire, son étape a pu partir avant lui', async () => {
      s.api.deleteTask.mockResolvedValue(null);
      s.api.deleteObjective.mockResolvedValue(null);
      s.store.deleteTask('t1');
      s.store.deleteTask('t1');
      s.store.deleteObjective('endurance');
      s.store.deleteTask('t2');
      await settle();
      expect(s.api.deleteTask).toHaveBeenCalledTimes(1);
      expect(s.api.deleteObjective).toHaveBeenCalledTimes(1);
    });

    it('une étape part avec ses pas et s’annonce, sans relecture', async () => {
      s.api.deleteObjective.mockResolvedValue(null);
      const before = reads();

      s.store.deleteObjective('endurance');
      expect(ids()).toEqual({ objectives: ['semi'], tasks: [] });
      await settle();

      expect(s.api.deleteObjective).toHaveBeenCalledWith('endurance');
      // L'API emporte les pas avec l'étape : aucun n'est effacé un par un.
      expect(s.api.deleteTask).not.toHaveBeenCalled();
      expect(s.announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.stageErased, 'polite');
      expect(reads()).toBe(before);
      expect(ids()).toEqual({ objectives: ['semi'], tasks: [] });
    });

    it('un objectif part avec ses étapes et leurs pas, et s’annonce', async () => {
      s.api.deleteObjective.mockResolvedValue(null);
      s.store.deleteObjective('semi');
      expect(ids()).toEqual({ objectives: [], tasks: [] });
      await settle();
      expect(s.api.deleteObjective).toHaveBeenCalledTimes(1);
      expect(s.api.deleteObjective).toHaveBeenCalledWith('semi');
      expect(s.announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.objectiveErased, 'polite');
      expect(s.store.objectiveCards()).toEqual([]);
    });

    it('un objectif déjà effacé côté serveur (404) l’est : rien à signaler', async () => {
      s.api.deleteObjective.mockRejectedValue(ko('OBJECTIVE_NOT_FOUND'));
      s.store.deleteObjective('semi');
      await settle();
      expect(ids()).toEqual({ objectives: [], tasks: [] });
      expect(s.annonces.signalement()).toBeNull();
      expect(s.announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.objectiveErased, 'polite');
    });

    it('une étape qui n’est pas effacée revient à sa place, avec ses pas, et c’est signalé', async () => {
      s.api.deleteObjective.mockRejectedValue(ko('FAIL_TO_SAVE_OBJECTIVE'));
      const before = { objectives: s.store.objectives(), tasks: s.store.tasks() };
      s.store.deleteObjective('endurance');
      await settle();
      expect(s.store.objectives()).toEqual(before.objectives);
      expect(s.store.tasks()).toEqual(before.tasks);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.eraseStage);
    });

    it('un objectif qui n’est pas effacé revient parmi les objectifs, et c’est signalé', async () => {
      s.api.deleteObjective.mockRejectedValue(ko('NETWORK_ERROR'));
      s.store.deleteObjective('semi');
      await settle();
      expect(ids()).toEqual({ objectives: ['semi', 'endurance'], tasks: ['t1', 't2'] });
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.eraseObjective);
    });

    it('un refus qui n’a rien à voir avec un texte garde la phrase de l’effacement', async () => {
      s.api.deleteTask.mockRejectedValue(ko('VALIDATION_ERROR'));
      s.store.deleteTask('t1');
      await settle();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.eraseTask);
    });
  });

  describe('les annonces', () => {
    it('annonce chaque réussite', async () => {
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      await settle();
      expect(s.announce.mock.calls).toEqual([
        [SUCCESS_ANNOUNCEMENTS.taskDone, 'polite'],
        [SUCCESS_ANNOUNCEMENTS.taskUndone, 'polite'],
      ]);
    });

    it('signale un chargement qui n’aboutit pas', async () => {
      s.api.objectiveTree.mockRejectedValueOnce(new Error('réseau'));
      s.store.loadObjectives();
      await settle();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
      expect(s.store.error()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });

  describe('une relecture sans réponse', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      s.api.objectiveTree.mockClear();
      s.api.objectiveTree.mockRejectedValue(ko('NETWORK_ERROR'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('insiste, le dit au bout de quelques essais, et s’en va dès que le serveur répond', async () => {
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(0);
      expect(s.api.objectiveTree).toHaveBeenCalledTimes(1);
      expect(s.annonces.signalement()).toBeNull();

      await vi.advanceTimersByTimeAsync(7000); // 1 s, 2 s, 4 s : le quatrième nouvel essai le dit.
      expect(s.api.objectiveTree).toHaveBeenCalledTimes(4);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.reloadObjectives);
      expect(s.store.error()).toBeNull();

      s.api.objectiveTree.mockResolvedValue(tree(LOADED));
      await vi.advanceTimersByTimeAsync(8000);
      expect(s.annonces.signalement()).toBeNull();
      expect(s.store.isFulfilled()).toBe(true);
    });

    it('s’arrête à la déconnexion, sans rien laisser à l’écran de connexion', async () => {
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(7000);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.reloadObjectives);

      s.store.clearObjectives();
      s.api.objectiveTree.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(s.api.objectiveTree).not.toHaveBeenCalled();
      expect(s.annonces.signalement()).toBeNull();
      expect(s.store.isPending()).toBe(false);
    });

    it('s’arrête sur un refus, qui est signalé', async () => {
      s.api.objectiveTree.mockRejectedValue(ko('UNAUTHENTICATED'));
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(s.api.objectiveTree).toHaveBeenCalledTimes(1);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.sessionEnded);
    });
  });
});

describe('la voix : tout ce qui est passé à annoncer() et signaler()', () => {
  /** Chaque action, dans chacune de ses issues : réussite, refus de l'API (avec ses codes), réseau, exception. */
  type Outcome =
    | 'success'
    | 'FAIL'
    | 'OBJECTIVE_NOT_FOUND'
    | 'TASK_NOT_FOUND'
    | 'VALIDATION_ERROR'
    | 'TOO_MANY_REQUESTS'
    | 'UNAUTHENTICATED'
    | 'NETWORK_ERROR'
    | 'throw';
  const OUTCOMES: Outcome[] = [
    'success',
    'FAIL',
    'OBJECTIVE_NOT_FOUND',
    'TASK_NOT_FOUND',
    'VALIDATION_ERROR',
    'TOO_MANY_REQUESTS',
    'UNAUTHENTICATED',
    'NETWORK_ERROR',
    'throw',
  ];

  const answer = (route: ReturnType<typeof vi.fn>, outcome: Outcome, data: unknown) => {
    if (outcome === 'success') route.mockResolvedValue(data);
    else if (outcome === 'throw') route.mockRejectedValue(new Error(DOMAIN_MESSAGE));
    else route.mockRejectedValue(ko(outcome));
  };

  it('chaque phrase parle comme Empreinte, et aucun message technique de l’API ne passe', async () => {
    const texts = new Set<string>();

    for (const outcome of OUTCOMES) {
      TestBed.resetTestingModule();
      const s = await setup();
      answer(s.api.createObjective, outcome, objective('o1', 'Guitare'));
      answer(s.api.addSubObjective, outcome, objective('e1', 'Accords', 'semi'));
      answer(s.api.addTaskToObjective, outcome, taskEntity('p1', 'Un', 'endurance'));
      answer(s.api.renameObjective, outcome, objective('semi', 'Semi en mai'));
      answer(s.api.renameTask, outcome, taskEntity('t1', 'Courir 10 km', 'endurance', 4, 1));
      answer(s.api.completeTask, outcome, taskEntity('t1', 'Courir 8 km', 'endurance', 4, 1, true));
      answer(s.api.reopenTask, outcome, taskEntity('t2', 'Sortie longue', 'endurance', 1, 1));
      answer(s.api.deleteTask, outcome, null);
      answer(s.api.deleteObjective, outcome, null);

      s.store.createObjective({ title: 'Guitare' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      // Les effacements en dernier, chacun réglé avant le suivant : un pas, puis son étape, puis l'objectif. (Un pas
      // refusé pendant que son étape part ne dit rien : c'est elle qui parle.)
      await settle();
      s.store.deleteTask('t2');
      await settle();
      s.store.deleteObjective('endurance');
      await settle();
      s.store.deleteObjective('semi');
      await settle();
      if (outcome === 'throw') {
        s.api.objectiveTree.mockRejectedValueOnce(new Error(DOMAIN_MESSAGE));
        s.store.loadObjectives();
      }
      await settle();

      for (const [text] of s.announce.mock.calls) texts.add(text as string);
    }

    // Dite au bout de quelques essais : voir « une relecture sans réponse ».
    texts.add(FAILURE_REPORTS.reloadObjectives);

    // Toutes les phrases de messages.constante.ts sont passées au moins une fois
    expect([...texts]).toEqual(expect.arrayContaining([
      ...Object.values(SUCCESS_ANNOUNCEMENTS),
      ...Object.values(FAILURE_REPORTS),
    ]));
    for (const text of texts) {
      expect(voiceIssues(text), text).toEqual([]);
      expect(text).not.toContain(DOMAIN_MESSAGE);
      expect(text).not.toMatch(/[A-Z_]{6,}/); // aucun code d'erreur
    }
  });
});
