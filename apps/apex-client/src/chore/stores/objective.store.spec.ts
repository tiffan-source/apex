import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { ObjectivesApi } from '../api/objectives.api';
import { ApiError } from '../api/api-error';
import type { ObjectivesResponse } from '../api/api.models';
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

const LOADED: ObjectivesResponse = {
  objectives: [
    { id: 'semi', title: 'Semi-marathon', description: '', why: '', dueDate: null, parentObjective: null, done: false },
    { id: 'endurance', title: 'Endurance', description: '', why: '', dueDate: null, parentObjective: 'semi', done: false },
  ],
  tasks: [
    { id: 't1', title: 'Courir 8 km', importance: 4, urgency: 1, done: false, objectiveId: 'endurance' },
    { id: 't2', title: 'Sortie longue', importance: 1, urgency: 1, done: true, objectiveId: 'endurance' },
  ],
};

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
function createApiMock(loaded: ObjectivesResponse) {
  return {
    list: vi.fn().mockResolvedValue(structuredClone(loaded)),
    create: vi.fn(),
    addSubObjective: vi.fn(),
    addTask: vi.fn(),
    edit: vi.fn(),
    editTask: vi.fn(),
    setTaskDone: vi.fn(),
    deleteObjective: vi.fn(),
    deleteTask: vi.fn(),
  };
}

/**
 * Un ObjectiveStore chargé avec `loaded`, son API simulée et le LiveAnnouncer espionné.
 * Avec `firstLoad`, le premier chargement attend cette promesse (et `loaded` sert aux suivants).
 */
async function setup(
  loaded: ObjectivesResponse = LOADED,
  firstLoad?: Promise<ObjectivesResponse>,
  session = { currentUserId: signal<string | null>('lea'), isAuthenticated: signal(true) },
) {
  const api = createApiMock(loaded);
  if (firstLoad) api.list.mockReturnValueOnce(firstLoad);
  const announce = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      ObjectiveStore,
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
  api.list.mockImplementation(async () => savedState(store));
  return { store, annonces, announce, api, session };
}

/** Ce que GET /v1/objectives rendrait : l'état du store, sans ce qui n'est pas encore enregistré. */
function savedState(store: InstanceType<typeof ObjectiveStore>): ObjectivesResponse {
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
        parentObjective: parentId,
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
  const temporaryIds = () => temporaryIdsOf(s.store);

  it('charge les objectifs de la personne connectée', () => {
    expect(s.api.list).toHaveBeenCalledTimes(1);
    expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance']);
    expect(s.store.objectiveCards().map((card) => card.id)).toEqual(['semi']);
  });

  describe('ce qui part vers l’API', () => {
    it('chaque geste appelle sa route avec le corps du contrat, sans l’id de la personne (l’API la reconnaît à son jeton)', async () => {
      s.api.create.mockResolvedValue({ id: 'guitare', title: 'Guitare' });
      s.api.addSubObjective.mockResolvedValue({ id: 'accords', title: 'Accords' });
      s.api.addTask.mockResolvedValue({ id: 'p1', title: 'Do, ré, mi', importance: 3, urgency: 2 });
      s.api.edit.mockResolvedValue({ id: 'semi', title: 'Semi en mai' });
      s.api.editTask.mockResolvedValue({ id: 't1', title: 'Courir 10 km', objectiveId: 'endurance', importance: 4, urgency: 1 });
      s.api.setTaskDone.mockResolvedValue({ id: 't2', title: 'Sortie longue', done: false });
      const dueDate = new Date(2027, 4, 1);

      s.store.createObjective({ title: 'Guitare', why: 'Jouer pour ma sœur', dueDate });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Do, ré, mi', importance: 3, urgency: 2 } });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai', description: '', dueDate });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      await settle();

      expect(s.api.create).toHaveBeenCalledWith({ title: 'Guitare', description: undefined, why: 'Jouer pour ma sœur', dueDate: dueDate.toISOString() });
      expect(s.api.addSubObjective).toHaveBeenCalledWith('semi', { title: 'Accords' });
      expect(s.api.addTask).toHaveBeenCalledWith('endurance', { title: 'Do, ré, mi', importance: 3, urgency: 2 });
      // Une description vidée part vide (effacée) ; un pourquoi absent reste inchangé.
      expect(s.api.edit).toHaveBeenCalledWith('semi', { title: 'Semi en mai', description: '', why: undefined, dueDate: dueDate.toISOString() });
      expect(s.api.editTask).toHaveBeenCalledWith('t1', { title: 'Courir 10 km', objectiveId: 'endurance', importance: 4, urgency: 1 });
      expect(s.api.setTaskDone).toHaveBeenCalledWith('t2', false);
      const sent = JSON.stringify(Object.values(s.api).flatMap((route) => route.mock.calls));
      expect(sent).not.toContain('lea');
      expect(sent).not.toContain('ownerId');
    });

    it('sans session, aucun geste ne part et rien ne reste en attente', async () => {
      TestBed.resetTestingModule();
      const t = await setup();
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      t.session.isAuthenticated.set(false);

      t.store.createObjective({ title: 'Guitare' });
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      t.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 3, objectiveId: 'endurance' } });
      await settle();

      expect(t.api.create).not.toHaveBeenCalled();
      expect(t.api.addTask).not.toHaveBeenCalled();
      expect(t.api.editTask).not.toHaveBeenCalled();
      expect(temporaryIdsOf(t.store)).toEqual([]);
      expect(t.store.isPending()).toBe(false);
    });

    it('un texte refusé par l’API (trop long) est signalé comme tel, et l’ajout optimiste est retiré', async () => {
      s.api.addTask.mockRejectedValueOnce(ko('VALIDATION_ERROR'));

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
      t.api.edit.mockReturnValue(new Promise(() => undefined)); // la réponse n'arrive pas : on regarde l'écran optimiste

      // La feuille d'une étape ne touche pas au pourquoi ; sans date, l'échéance reste.
      t.store.editObjective({ id: 'endurance', title: 'Fond', description: '' });
      await settle();

      expect(t.store.objectives().find((item) => item.id === 'endurance')).toMatchObject({
        title: 'Fond',
        description: '',
        why: 'Finir le semi',
        dueDate: '2027-04-01T00:00:00.000Z',
      });
    });
  });

  describe('gestes rapprochés : aucune réponse ne se perd', () => {
    it('deux pas ajoutés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.api.addTask
        .mockResolvedValueOnce({ id: 'p1', title: 'Un', importance: 3, urgency: 3 })
        .mockResolvedValueOnce({ id: 'p2', title: 'Deux', importance: 3, urgency: 3 });

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Deux', importance: 3, urgency: 3 } });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1', 'p2']);
      expect(s.announce).toHaveBeenCalledTimes(2);
    });

    it('deux étapes ajoutées coup sur coup reçoivent toutes deux leur id définitif', async () => {
      s.api.addSubObjective.mockResolvedValueOnce({ id: 'e1', title: 'Une' }).mockResolvedValueOnce({ id: 'e2', title: 'Deux' });

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Une' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.stageOptions('semi').map((option) => option.valeur)).toEqual(['endurance', 'e1', 'e2']);
    });

    it('deux objectifs créés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.api.create.mockResolvedValueOnce({ id: 'o1', title: 'Un' }).mockResolvedValueOnce({ id: 'o2', title: 'Deux' });

      s.store.createObjective({ title: 'Un' });
      s.store.createObjective({ title: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.objectiveOptions().map((option) => option.valeur)).toEqual(['semi', 'o1', 'o2']);
      expect(s.store.lastCreatedObjectiveId()).toBe('o2');
    });

    it('le retour en arrière d’un pas modifié a lieu même si un autre pas est modifié juste après', async () => {
      s.api.editTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce({});

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't2', input: { title: 'Sortie de 2 h', importance: 1, urgency: 1, objectiveId: 'endurance' } });
      await settle();

      expect(task('t1')?.title).toBe('Courir 8 km');
      expect(task('t2')?.title).toBe('Sortie de 2 h');
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editTask);
    });

    it('le retour en arrière d’un objectif modifié a lieu même si un autre est modifié juste après', async () => {
      s.api.edit.mockRejectedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE')).mockResolvedValueOnce({});

      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      s.store.editObjective({ id: 'endurance', title: 'Fond' });
      await settle();

      expect(s.store.objectives().map((item) => item.title)).toEqual(['Semi-marathon', 'Fond']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editObjective);
    });
  });

  describe('les écritures partent une par une, dans l’ordre des gestes', () => {
    it('le second geste attend la réponse du premier', async () => {
      const first = deferred<unknown>();
      s.api.setTaskDone.mockReturnValueOnce(first.promise).mockResolvedValueOnce({});

      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't1', done: false });
      await settle();
      expect(s.api.setTaskDone).toHaveBeenCalledTimes(1);
      expect(task('t1')?.done).toBe(false);

      first.resolve({});
      await settle();
      expect(s.api.setTaskDone.mock.calls).toEqual([
        ['t1', true],
        ['t1', false],
      ]);
    });

    it('un retour en arrière n’écrase pas un geste plus récent', async () => {
      s.api.editTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce({});

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 3, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 2, urgency: 3, objectiveId: 'endurance' } });
      await settle();

      expect(task('t1')).toMatchObject({ importance: 2, urgency: 3 });
    });

    it('un pas recoché après un échec reste coché', async () => {
      s.api.setTaskDone.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce({});

      s.store.updateTaskDone({ taskId: 't2', done: false });
      s.store.updateTaskDone({ taskId: 't2', done: true });
      await settle();

      expect(task('t2')?.done).toBe(true);
    });

    it('un geste en attente ne part pas si une autre personne s’est connectée entre-temps (un autre onglet)', async () => {
      const first = deferred<unknown>();
      s.api.setTaskDone.mockReturnValueOnce(first.promise);
      s.api.addTask.mockResolvedValue({ id: 'p9', title: 'Un', importance: 3, urgency: 3 });

      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      await settle();
      s.session.currentUserId.set('noe');
      first.resolve({});
      await settle();

      // Le pas de Léa n'est pas écrit dans le compte de Noé.
      expect(s.api.addTask).not.toHaveBeenCalled();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.sessionEnded);
    });
  });

  describe('gestes sur un élément encore optimiste', () => {
    it('un pas ajouté à une étape pas encore enregistrée part avec l’id définitif de l’étape', async () => {
      s.api.addSubObjective.mockResolvedValueOnce({ id: 'portfolio', title: 'Portfolio' });
      s.api.addTask.mockResolvedValueOnce({ id: 'p1', title: 'Trois projets', importance: 3, urgency: 2 });

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      const stageId = s.store.stageOptions('semi')[1].valeur;
      expect(isTemporaryId(stageId)).toBe(true);
      s.store.addTaskToObjective({ objectiveId: stageId, task: { title: 'Trois projets', importance: 3, urgency: 2 } });
      await settle();

      expect(s.api.addTask).toHaveBeenCalledWith('portfolio', expect.objectContaining({ title: 'Trois projets' }));
      expect(task('p1')?.objectiveId).toBe('portfolio');
      expect(s.store.objectiveDetail('semi')?.stages[1].tasks.map((item) => item.id)).toEqual(['p1']);
      expect(temporaryIds()).toEqual([]);
    });

    it('un pas ajouté avec l’id temporaire d’une étape enregistrée entre-temps va dans cette étape, à l’écran aussi', async () => {
      s.api.addSubObjective.mockResolvedValueOnce({ id: 'portfolio', title: 'Portfolio' });
      s.api.addTask.mockResolvedValueOnce({ id: 'p1', title: 'Trois projets', importance: 3, urgency: 2 });

      // La feuille « Ajouter un pas » s'ouvre sur l'étape encore optimiste ; l'étape est enregistrée pendant qu'on écrit.
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      const temporaryStageId = s.store.stageOptions('semi')[1].valeur;
      await settle();
      expect(s.store.stageOptions('semi')[1].valeur).toBe('portfolio');

      s.store.addTaskToObjective({ objectiveId: temporaryStageId, task: { title: 'Trois projets', importance: 3, urgency: 2 } });
      // Tout de suite, et pas seulement au prochain chargement : le pas est dans l'étape, et compté.
      expect(s.store.tasks().at(-1)?.objectiveId).toBe('portfolio');
      expect(s.store.objectiveDetail('semi')?.stages[1].tasks.map((item) => item.title)).toEqual(['Trois projets']);
      await settle();

      expect(s.api.addTask).toHaveBeenCalledWith('portfolio', expect.objectContaining({ title: 'Trois projets' }));
      expect(task('p1')?.objectiveId).toBe('portfolio');
      expect(s.store.objectiveDetail('semi')?.stages[1].tasks.map((item) => item.id)).toEqual(['p1']);
    });

    it('un pas rangé dans une étape enregistrée pendant que la feuille était ouverte la rejoint à l’écran', async () => {
      s.api.addSubObjective.mockResolvedValueOnce({ id: 'portfolio', title: 'Portfolio' });
      s.api.editTask.mockResolvedValueOnce({});

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      const temporaryStageId = s.store.stageOptions('semi')[1].valeur;
      await settle();

      // La feuille « Modifier le pas » avait proposé l'étape avec son id temporaire.
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 1, objectiveId: temporaryStageId } });
      expect(task('t1')?.objectiveId).toBe('portfolio');
      await settle();

      expect(s.api.editTask).toHaveBeenCalledWith('t1', expect.objectContaining({ objectiveId: 'portfolio' }));
      expect(s.store.objectiveDetail('semi')?.stages.map((stage) => stage.tasks.map((item) => item.id))).toEqual([['t2'], ['t1']]);
    });

    it('une étape ajoutée à un objectif pas encore enregistré part avec son id définitif', async () => {
      s.api.create.mockResolvedValueOnce({ id: 'guitare', title: 'Guitare' });
      s.api.addSubObjective.mockResolvedValueOnce({ id: 'accords', title: 'Accords' });

      s.store.createObjective({ title: 'Guitare' });
      const objectiveId = s.store.objectiveOptions()[1].valeur;
      s.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      await settle();

      expect(s.api.addSubObjective).toHaveBeenCalledWith('guitare', { title: 'Accords' });
      expect(s.store.stageOptions('guitare')).toEqual([{ valeur: 'accords', libelle: 'Accords' }]);
    });

    it('un pas coché avant d’être enregistré est enregistré coché, avec son id définitif', async () => {
      s.api.addTask.mockResolvedValueOnce({ id: 'p1', title: 'Un', importance: 3, urgency: 3 });
      s.api.setTaskDone.mockResolvedValueOnce({});

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      const temporaryId = s.store.tasks()[2].id;
      s.store.updateTaskDone({ taskId: temporaryId, done: true });
      await settle();

      expect(s.api.setTaskDone).toHaveBeenCalledWith('p1', true);
      expect(task('p1')?.done).toBe(true);
    });

    it('un geste sur un pas dont l’ajout n’a pas abouti ne part pas, et ne masque pas le premier signalement', async () => {
      s.api.addTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      const temporaryId = s.store.tasks()[2].id;
      s.store.updateTaskDone({ taskId: temporaryId, done: true });
      s.store.editTask({ taskId: temporaryId, input: { title: 'Un', importance: 1, urgency: 1, objectiveId: 'endurance' } });
      await settle();

      expect(s.api.setTaskDone).not.toHaveBeenCalled();
      expect(s.api.editTask).not.toHaveBeenCalled();
      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.addTask);
    });

    it('une étape posée sur un objectif dont la création n’a pas abouti disparaît avec lui', async () => {
      s.api.create.mockRejectedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));

      s.store.createObjective({ title: 'Guitare' });
      const objectiveId = s.store.objectiveOptions()[1].valeur;
      s.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      await settle();

      expect(s.api.addSubObjective).not.toHaveBeenCalled();
      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.createObjective);
      expect(s.store.isPending()).toBe(false);
    });
  });

  describe('objectivesLoaded : la mémoire du chargement', () => {
    it('vrai une fois chargé, et il le reste quand une écriture passe par requestStatus', async () => {
      expect(s.store.objectivesLoaded()).toBe(true);
      s.api.create.mockRejectedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));
      s.store.createObjective({ title: 'Guitare' });
      expect(s.store.isPending()).toBe(true);
      expect(s.store.objectivesLoaded()).toBe(true);
      await settle();
      expect(s.store.error()).toBe(FAILURE_REPORTS.createObjective);
      expect(s.store.objectivesLoaded()).toBe(true);
    });

    it('faux pendant le premier chargement, et après un chargement qui n’aboutit pas', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectivesResponse>();
      const t = await setup(LOADED, load.promise);
      expect(t.store.isPending()).toBe(true);
      expect(t.store.objectivesLoaded()).toBe(false);

      load.resolve(structuredClone(LOADED));
      await settle();
      expect(t.store.objectivesLoaded()).toBe(true);

      t.store.clearObjectives(); // déconnexion
      expect(t.store.objectivesLoaded()).toBe(false);
      t.api.list.mockRejectedValueOnce(new Error('réseau'));
      t.store.loadObjectives();
      await settle();
      expect(t.store.objectivesLoaded()).toBe(false);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });

  describe('le chargement garde les créations en vol', () => {
    it('le premier chargement garde l’objectif, l’étape et le pas encore optimistes', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectivesResponse>();
      const t = await setup(LOADED, load.promise);
      const created = deferred<unknown>();
      t.api.create.mockReturnValueOnce(created.promise);
      t.api.addSubObjective.mockResolvedValueOnce({ id: 'accords', title: 'Accords' });
      t.api.addTask.mockResolvedValueOnce({ id: 'p1', title: 'Do, ré, mi', importance: 3, urgency: 2 });

      // « Je m'y engage » avant la fin du premier chargement, puis une étape et un pas sur cet objectif
      t.store.createObjective({ title: 'Guitare' });
      const objectiveId = t.store.objectiveOptions()[0].valeur;
      t.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      const stageId = t.store.stageOptions(objectiveId)[0].valeur;
      t.store.addTaskToObjective({ objectiveId: stageId, task: { title: 'Do, ré, mi', importance: 3, urgency: 2 } });
      await settle();
      // Les écritures attendent le chargement : elles partent après sa lecture de la base
      expect(t.api.create).not.toHaveBeenCalled();

      load.resolve(structuredClone(LOADED));
      await settle();
      // Le chargement a remplacé l'état : les éléments optimistes sont toujours là, après les éléments chargés
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', objectiveId, stageId]);
      expect(t.store.tasks().map((item) => item.title)).toEqual(['Courir 8 km', 'Sortie longue', 'Do, ré, mi']);
      expect(t.store.tasks()[2]).toMatchObject({ objectiveId: stageId, done: false });
      expect(t.api.create).toHaveBeenCalledTimes(1);

      created.resolve({ id: 'guitare', title: 'Guitare' });
      await settle();
      expect(temporaryIdsOf(t.store)).toEqual([]);
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare', 'accords']);
      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1']);
      expect(t.store.objectiveDetail('guitare')?.stages[0].tasks.map((item) => item.id)).toEqual(['p1']);
      expect(t.store.lastCreatedObjectiveId()).toBe('guitare');
    });

    it('un objectif créé juste avant un rechargement n’est ni perdu ni en double', async () => {
      let saved = false;
      s.api.create.mockImplementationOnce(async () => {
        saved = true;
        return { id: 'guitare', title: 'Guitare' };
      });
      // La base, lue après l'écriture, contient le nouvel objectif
      s.api.list.mockImplementationOnce(async () => ({
        objectives: [
          ...LOADED.objectives,
          ...(saved ? [{ id: 'guitare', title: 'Guitare', description: '', why: '', dueDate: null, parentObjective: null, done: false }] : []),
        ],
        tasks: LOADED.tasks,
      }));

      s.store.createObjective({ title: 'Guitare' });
      s.store.loadObjectives();
      await settle();

      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare']);
      expect(s.api.create.mock.invocationCallOrder[0]).toBeLessThan(s.api.list.mock.invocationCallOrder[1]);
    });

    it('un pas coché pendant un rechargement reste coché : la base est relue après son écriture', async () => {
      // Une base simulée : ce que la coche enregistre, la lecture suivante le rend.
      let t1DoneInDb = false;
      s.api.setTaskDone.mockImplementation(async (_taskId: string, done: boolean) => {
        t1DoneInDb = done;
        return {};
      });
      s.api.list.mockImplementation(async () => ({
        ...structuredClone(LOADED),
        tasks: LOADED.tasks.map((item) => (item.id === 't1' ? { ...item, done: t1DoneInDb } : item)),
      }));
      const reload = deferred<ObjectivesResponse>();
      s.api.list.mockReturnValueOnce(reload.promise);

      // Le rechargement de fin de tour d'Akari lit la base ; la personne coche t1 pendant ce temps.
      s.store.loadObjectives();
      await settle();
      s.store.updateTaskDone({ taskId: 't1', done: true });
      expect(task('t1')?.done).toBe(true);

      // La lecture, faite avant l'écriture de la coche, rend t1 à faire : elle n'efface pas la coche.
      reload.resolve(structuredClone(LOADED));
      await settle();

      expect(s.api.setTaskDone).toHaveBeenCalledWith('t1', true);
      expect(t1DoneInDb).toBe(true);
      expect(task('t1')?.done).toBe(true);
      // Le premier chargement, le rechargement, sa relecture, puis la lecture qui suit la coche.
      expect(s.api.list).toHaveBeenCalledTimes(4);
      expect(s.store.isPending()).toBe(false);
      expect(s.store.error()).toBeNull();
    });

    it('un rechargement sans geste pendant sa lecture ne relit pas la base', async () => {
      s.store.loadObjectives();
      await settle();
      expect(s.api.list).toHaveBeenCalledTimes(2);
    });

    it('un pas dont l’ajout n’aboutit pas après le chargement disparaît quand même', async () => {
      TestBed.resetTestingModule();
      const load = deferred<ObjectivesResponse>();
      const t = await setup(LOADED, load.promise);
      t.api.addTask.mockRejectedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      load.resolve(structuredClone(LOADED));
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 2 } });
      await settle();

      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.addTask);
    });
  });

  describe('fait ou non fait : c’est l’API qui le dit', () => {
    const stageDone = () => s.store.objectiveDetail('semi')?.stages[0].done;
    /** La base après l'écriture : l'étape et l'objectif sont faits. */
    const allDone = (): ObjectivesResponse => ({
      objectives: LOADED.objectives.map((item) => ({ ...item, done: true })),
      tasks: LOADED.tasks.map((item) => ({ ...item, done: true })),
    });

    it('un pas coché change tout de suite, et l’étape quand l’API la dit faite', async () => {
      s.api.setTaskDone.mockResolvedValue({ id: 't1', title: 'Courir 8 km', done: true });
      s.api.list.mockImplementation(async () => allDone());

      s.store.updateTaskDone({ taskId: 't1', done: true });
      expect(task('t1')?.done).toBe(true);
      expect(stageDone()).toBe(false);

      await settle();
      expect(stageDone()).toBe(true);
      expect(s.store.objectiveCards()).toEqual([]);
      expect(s.store.accomplishedObjectives().map((card) => card.id)).toEqual(['semi']);
    });

    it('l’état ne se déduit jamais des pas : tous cochés, l’étape reste à faire si l’API le dit', async () => {
      s.api.setTaskDone.mockResolvedValue({ id: 't1', title: 'Courir 8 km', done: true });

      s.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(s.store.tasks().every((item) => item.done)).toBe(true);
      expect(stageDone()).toBe(false);
    });

    it('relit après un pas ajouté, et après un pas modifié', async () => {
      s.api.addTask.mockResolvedValue({ id: 'p1', title: 'Fractionné', importance: 3, urgency: 2 });
      s.api.editTask.mockResolvedValue({ id: 't1', title: 'Courir 9 km', objectiveId: 'endurance', importance: 4, urgency: 1 });
      const reads = s.api.list.mock.calls.length;

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Fractionné', importance: 3, urgency: 2 } });
      await settle();
      expect(s.api.list.mock.calls.length).toBe(reads + 1);

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 9 km', objectiveId: 'endurance', importance: 4, urgency: 1 } });
      await settle();
      expect(s.api.list.mock.calls.length).toBe(reads + 2);
    });

    it('ne relit rien quand l’écriture est refusée', async () => {
      s.api.setTaskDone.mockRejectedValue(ko('FAIL_TO_SAVE_TASK'));
      const reads = s.api.list.mock.calls.length;

      s.store.updateTaskDone({ taskId: 't1', done: true });
      await settle();

      expect(s.api.list.mock.calls.length).toBe(reads);
      expect(task('t1')?.done).toBe(false);
    });
  });

  describe('effacer', () => {
    const ids = () => ({
      objectives: s.store.objectives().map((item) => item.id),
      tasks: s.store.tasks().map((item) => item.id),
    });

    it('un pas quitte l’état tout de suite, part par DELETE, puis la base est relue', async () => {
      s.api.deleteTask.mockResolvedValue(null);
      const reads = s.api.list.mock.calls.length;
      const announced = s.announce.mock.calls.length;

      s.store.deleteTask('t1');
      expect(task('t1')).toBeUndefined();
      await settle();

      expect(s.api.deleteTask).toHaveBeenCalledWith('t1');
      // Sans ce pas, son étape peut être faite : c'est l'API qui le dit.
      expect(s.api.list.mock.calls.length).toBe(reads + 1);
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

    it('un pas qui n’est pas effacé revient à sa place, et c’est signalé', async () => {
      s.api.deleteTask.mockRejectedValue(ko('NETWORK_ERROR'));
      const reads = s.api.list.mock.calls.length;
      s.store.deleteTask('t1');
      await settle();
      expect(ids().tasks).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.eraseTask);
      expect(s.api.list.mock.calls.length).toBe(reads);
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

    it('une étape part avec ses pas, s’annonce, puis la base est relue', async () => {
      s.api.deleteObjective.mockResolvedValue(null);
      const reads = s.api.list.mock.calls.length;

      s.store.deleteObjective('endurance');
      expect(ids()).toEqual({ objectives: ['semi'], tasks: [] });
      await settle();

      expect(s.api.deleteObjective).toHaveBeenCalledWith('endurance');
      // L'API emporte les pas avec l'étape : aucun n'est effacé un par un.
      expect(s.api.deleteTask).not.toHaveBeenCalled();
      expect(s.announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.stageErased, 'polite');
      expect(s.api.list.mock.calls.length).toBe(reads + 1);
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

    it('une étape encore en création part avec son id définitif, et ne revient pas', async () => {
      const created = deferred<{ id: string; title: string }>();
      s.api.addSubObjective.mockReturnValue(created.promise);
      s.api.deleteObjective.mockResolvedValue(null);

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Sommeil' });
      const temporary = s.store.objectives().find((item) => item.title === 'Sommeil')?.id ?? '';
      expect(isTemporaryId(temporary)).toBe(true);
      s.store.deleteObjective(temporary);
      expect(s.store.objectives().some((item) => item.title === 'Sommeil')).toBe(false);

      created.resolve({ id: 'sommeil', title: 'Sommeil' });
      await settle();
      expect(s.api.deleteObjective).toHaveBeenCalledWith('sommeil');
      expect(s.store.objectives().some((item) => item.title === 'Sommeil')).toBe(false);
    });

    it('un pas dont l’ajout n’a pas abouti ne part pas en DELETE', async () => {
      s.api.addTask.mockRejectedValue(ko('FAIL_TO_SAVE_TASK'));
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Fractionné', importance: 3, urgency: 3 } });
      const temporary = s.store.tasks().find((item) => item.title === 'Fractionné')?.id ?? '';
      s.store.deleteTask(temporary);
      await settle();
      expect(s.api.deleteTask).not.toHaveBeenCalled();
      expect(s.store.tasks().some((item) => item.title === 'Fractionné')).toBe(false);
    });
  });

  describe('les annonces', () => {
    it('annonce chaque réussite', async () => {
      s.api.setTaskDone.mockResolvedValue({});
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      await settle();
      expect(s.announce.mock.calls).toEqual([
        [SUCCESS_ANNOUNCEMENTS.taskDone, 'polite'],
        [SUCCESS_ANNOUNCEMENTS.taskUndone, 'polite'],
      ]);
    });

    it('signale un chargement qui n’aboutit pas', async () => {
      s.api.list.mockRejectedValueOnce(new Error('réseau'));
      s.store.loadObjectives();
      await settle();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
      expect(s.store.error()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });

  describe('une relecture sans réponse', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      s.api.list.mockClear();
      s.api.list.mockRejectedValue(ko('NETWORK_ERROR'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('insiste, le dit au bout de quelques essais, et s’en va dès que le serveur répond', async () => {
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(0);
      expect(s.api.list).toHaveBeenCalledTimes(1);
      expect(s.annonces.signalement()).toBeNull();

      await vi.advanceTimersByTimeAsync(7000); // 1 s, 2 s, 4 s : le quatrième nouvel essai le dit.
      expect(s.api.list).toHaveBeenCalledTimes(4);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.reloadObjectives);
      expect(s.store.error()).toBeNull();

      const answered: ObjectivesResponse = structuredClone(LOADED);
      answered.objectives[1].done = true;
      s.api.list.mockResolvedValue(answered);
      await vi.advanceTimersByTimeAsync(8000);
      expect(s.annonces.signalement()).toBeNull();
      expect(s.store.isFulfilled()).toBe(true);
    });

    it('s’arrête à la déconnexion, sans rien laisser à l’écran de connexion', async () => {
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(7000);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.reloadObjectives);

      s.store.clearObjectives();
      s.api.list.mockClear();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(s.api.list).not.toHaveBeenCalled();
      expect(s.annonces.signalement()).toBeNull();
      expect(s.store.isPending()).toBe(false);
    });

    it('s’arrête sur un refus, qui est signalé', async () => {
      s.api.list.mockRejectedValue(ko('UNAUTHENTICATED'));
      s.store.loadObjectives();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(s.api.list).toHaveBeenCalledTimes(1);
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
      answer(s.api.create, outcome, { id: 'o1', title: 'Guitare' });
      answer(s.api.addSubObjective, outcome, { id: 'e1', title: 'Accords' });
      answer(s.api.addTask, outcome, { id: 'p1', title: 'Un', importance: 3, urgency: 3 });
      answer(s.api.edit, outcome, { id: 'semi', title: 'Semi en mai' });
      answer(s.api.editTask, outcome, { id: 't1', title: 'Courir 10 km', objectiveId: 'endurance', importance: 4, urgency: 1 });
      answer(s.api.setTaskDone, outcome, { id: 't1', title: 'Courir 8 km', done: true });
      answer(s.api.deleteTask, outcome, null);
      answer(s.api.deleteObjective, outcome, null);

      s.store.createObjective({ title: 'Guitare' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      // Les effacements en dernier : un pas, puis son étape, puis l'objectif.
      s.store.deleteTask('t2');
      s.store.deleteObjective('endurance');
      s.store.deleteObjective('semi');
      if (outcome === 'throw') {
        s.api.list.mockRejectedValueOnce(new Error(DOMAIN_MESSAGE));
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
