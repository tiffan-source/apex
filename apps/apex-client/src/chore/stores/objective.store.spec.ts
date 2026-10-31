import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { QUADRANTS, type Quadrant } from '../../ui';
import { ApexLibsMetier, EisenhowerCategory } from '@org/apex-library';
import {
  AddSubObjectiveUsecase,
  AddTaskToObjectiveUsecase,
  CreateObjectiveUsecase,
  EditMyTaskUsecase,
  EditObjectiveUsecase,
  GetAllObjectiveAndTaskQuery,
  UpdateDoneStatusOfTaskUsecase,
  type GetAllObjectiveAndTaskOutput,
  type TaskOutput,
} from '@org/objective';
import { SessionStore } from './session.store';
import { AnnoncesStore } from './annonces.store';
import { ObjectiveStore } from './objective.store';
import { isTemporaryId } from './utils/map-optimistique-id';
import { FAILURE_REPORTS, SUCCESS_ANNOUNCEMENTS, taskMovedAnnouncement, voiceIssues } from '../constants/messages.constante';

/*
 * ObjectiveStore entier, cas d'usage simulés : gestes rapprochés (rien ne se perd, rien ne s'écrase),
 * ids temporaires, retours en arrière, déplacements dans la matrice, voix de tout ce qui est annoncé.
 */

/** Le message technique (anglais) d'un échec du domaine : il ne doit jamais atteindre la personne. */
const DOMAIN_MESSAGE = 'Technical failure from the domain';

const LOADED: GetAllObjectiveAndTaskOutput = {
  objectives: [
    { id: 'semi', title: 'Semi-marathon', description: '', why: '', dueDate: null, parentObjective: null },
    { id: 'endurance', title: 'Endurance', description: '', why: '', dueDate: null, parentObjective: 'semi' },
  ],
  tasks: [
    { id: 't1', title: 'Courir 8 km', importance: 4, urgency: 1, done: false, objectiveId: 'endurance' },
    { id: 't2', title: 'Sortie longue', importance: 1, urgency: 1, done: true, objectiveId: 'endurance' },
  ],
};

const ok = <T>(data: T) => ({ success: true as const, data });
const ko = (code: string) => ({ success: false as const, error: { code, message: DOMAIN_MESSAGE } });

/** Laisse les promesses et la file d'écritures se vider. */
const settle = async () => {
  for (let i = 0; i < 10; i++) await new Promise((resolve) => setTimeout(resolve));
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

type Mock = { execute: ReturnType<typeof vi.fn> };

/**
 * Un ObjectiveStore chargé avec `loaded`, ses cas d'usage simulés et le LiveAnnouncer espionné.
 * Avec `firstLoad`, le premier chargement attend cette promesse (et `loaded` sert aux suivants).
 */
async function setup(loaded: GetAllObjectiveAndTaskOutput = LOADED, firstLoad?: Promise<GetAllObjectiveAndTaskOutput>) {
  const query = vi.fn().mockResolvedValue(structuredClone(loaded));
  if (firstLoad) query.mockReturnValueOnce(firstLoad);
  const usecases = {
    query: { execute: query } as Mock,
    create: { execute: vi.fn() } as Mock,
    addSub: { execute: vi.fn() } as Mock,
    addTask: { execute: vi.fn() } as Mock,
    editObjective: { execute: vi.fn() } as Mock,
    editTask: { execute: vi.fn() } as Mock,
    toggle: { execute: vi.fn() } as Mock,
  };
  const announce = vi.fn().mockResolvedValue(undefined);
  TestBed.configureTestingModule({
    providers: [
      ObjectiveStore,
      { provide: GetAllObjectiveAndTaskQuery, useValue: usecases.query },
      { provide: CreateObjectiveUsecase, useValue: usecases.create },
      { provide: AddSubObjectiveUsecase, useValue: usecases.addSub },
      { provide: AddTaskToObjectiveUsecase, useValue: usecases.addTask },
      { provide: EditObjectiveUsecase, useValue: usecases.editObjective },
      { provide: EditMyTaskUsecase, useValue: usecases.editTask },
      { provide: UpdateDoneStatusOfTaskUsecase, useValue: usecases.toggle },
      { provide: SessionStore, useValue: { currentUserId: signal('lea') } },
      { provide: LiveAnnouncer, useValue: { announce } },
    ],
  });
  const store = TestBed.inject(ObjectiveStore);
  const annonces = TestBed.inject(AnnoncesStore);
  TestBed.tick();
  await settle();
  return { store, annonces, announce, ...usecases };
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
    expect(s.query.execute).toHaveBeenCalledWith({ ownerId: 'lea' });
    expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance']);
    expect(s.store.objectiveCards().map((card) => card.id)).toEqual(['semi']);
  });

  describe('gestes rapprochés : aucune réponse ne se perd', () => {
    it('deux pas ajoutés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.addTask.execute
        .mockResolvedValueOnce(ok({ id: 'p1', title: 'Un', importance: 3, urgency: 3 }))
        .mockResolvedValueOnce(ok({ id: 'p2', title: 'Deux', importance: 3, urgency: 3 }));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Deux', importance: 3, urgency: 3 } });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1', 'p2']);
      expect(s.announce).toHaveBeenCalledTimes(2);
    });

    it('deux étapes ajoutées coup sur coup reçoivent toutes deux leur id définitif', async () => {
      s.addSub.execute.mockResolvedValueOnce(ok({ id: 'e1', title: 'Une' })).mockResolvedValueOnce(ok({ id: 'e2', title: 'Deux' }));

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Une' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.stageOptions('semi').map((option) => option.valeur)).toEqual(['endurance', 'e1', 'e2']);
    });

    it('deux objectifs créés coup sur coup reçoivent tous deux leur id définitif', async () => {
      s.create.execute.mockResolvedValueOnce(ok({ id: 'o1', title: 'Un' })).mockResolvedValueOnce(ok({ id: 'o2', title: 'Deux' }));

      s.store.createObjective({ title: 'Un' });
      s.store.createObjective({ title: 'Deux' });
      await settle();

      expect(temporaryIds()).toEqual([]);
      expect(s.store.objectiveOptions().map((option) => option.valeur)).toEqual(['semi', 'o1', 'o2']);
      expect(s.store.lastCreatedObjectiveId()).toBe('o2');
    });

    it('le retour en arrière d’un pas modifié a lieu même si un autre pas est modifié juste après', async () => {
      s.editTask.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce(ok({}));

      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.editTask({ taskId: 't2', input: { title: 'Sortie de 2 h', importance: 1, urgency: 1, objectiveId: 'endurance' } });
      await settle();

      expect(task('t1')?.title).toBe('Courir 8 km');
      expect(task('t2')?.title).toBe('Sortie de 2 h');
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.editTask);
    });

    it('le retour en arrière d’un objectif modifié a lieu même si un autre est modifié juste après', async () => {
      s.editObjective.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE')).mockResolvedValueOnce(ok({}));

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
      s.toggle.execute.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok({}));

      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't1', done: false });
      await settle();
      expect(s.toggle.execute).toHaveBeenCalledTimes(1);
      expect(task('t1')?.done).toBe(false);

      first.resolve(ok({}));
      await settle();
      expect(s.toggle.execute.mock.calls.map(([input]) => input)).toEqual([
        { taskId: 't1', done: true },
        { taskId: 't1', done: false },
      ]);
    });

    it('un retour en arrière n’écrase pas un geste plus récent', async () => {
      s.editTask.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce(ok({}));

      s.store.moveTaskToQuadrant('t1', 'maintenant'); // 4/1 → 4/3
      s.store.moveTaskToQuadrant('t1', 'confier'); // 4/3 → 2/3
      await settle();

      expect(task('t1')).toMatchObject({ importance: 2, urgency: 3 });
      expect(s.store.matrix().confier.map((item) => item.id)).toEqual(['t1']);
    });

    it('un pas recoché après un échec reste coché', async () => {
      s.toggle.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_TASK')).mockResolvedValueOnce(ok({}));

      s.store.updateTaskDone({ taskId: 't2', done: false });
      s.store.updateTaskDone({ taskId: 't2', done: true });
      await settle();

      expect(task('t2')?.done).toBe(true);
    });
  });

  describe('gestes sur un élément encore optimiste', () => {
    it('un pas ajouté à une étape pas encore enregistrée part avec l’id définitif de l’étape', async () => {
      s.addSub.execute.mockResolvedValueOnce(ok({ id: 'portfolio', title: 'Portfolio' }));
      s.addTask.execute.mockResolvedValueOnce(ok({ id: 'p1', title: 'Trois projets', importance: 3, urgency: 2 }));

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      const stageId = s.store.stageOptions('semi')[1].valeur;
      expect(isTemporaryId(stageId)).toBe(true);
      s.store.addTaskToObjective({ objectiveId: stageId, task: { title: 'Trois projets', importance: 3, urgency: 2 } });
      await settle();

      expect(s.addTask.execute).toHaveBeenCalledWith('portfolio', expect.objectContaining({ title: 'Trois projets' }));
      expect(task('p1')?.objectiveId).toBe('portfolio');
      expect(s.store.objectiveDetail('semi')?.stages[1].tasks.map((item) => item.id)).toEqual(['p1']);
      expect(temporaryIds()).toEqual([]);
    });

    it('un pas ajouté avec l’id temporaire d’une étape enregistrée entre-temps va dans cette étape, à l’écran aussi', async () => {
      s.addSub.execute.mockResolvedValueOnce(ok({ id: 'portfolio', title: 'Portfolio' }));
      s.addTask.execute.mockResolvedValueOnce(ok({ id: 'p1', title: 'Trois projets', importance: 3, urgency: 2 }));

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

      expect(s.addTask.execute).toHaveBeenCalledWith('portfolio', expect.objectContaining({ title: 'Trois projets' }));
      expect(task('p1')?.objectiveId).toBe('portfolio');
      expect(s.store.matrix().planifier.find((item) => item.id === 'p1')?.rootObjectiveId).toBe('semi');
    });

    it('un pas rangé dans une étape enregistrée pendant que la feuille était ouverte la rejoint à l’écran', async () => {
      s.addSub.execute.mockResolvedValueOnce(ok({ id: 'portfolio', title: 'Portfolio' }));
      s.editTask.execute.mockResolvedValueOnce(ok({}));

      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Portfolio' });
      const temporaryStageId = s.store.stageOptions('semi')[1].valeur;
      await settle();

      // La feuille « Modifier le pas » avait proposé l'étape avec son id temporaire.
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 8 km', importance: 4, urgency: 1, objectiveId: temporaryStageId } });
      expect(task('t1')?.objectiveId).toBe('portfolio');
      await settle();

      expect(s.editTask.execute).toHaveBeenCalledWith(expect.objectContaining({ task: expect.objectContaining({ id: 't1', objectiveId: 'portfolio' }) }));
      expect(s.store.objectiveDetail('semi')?.stages.map((stage) => stage.tasks.map((item) => item.id))).toEqual([['t2'], ['t1']]);
    });

    it('une étape ajoutée à un objectif pas encore enregistré part avec son id définitif', async () => {
      s.create.execute.mockResolvedValueOnce(ok({ id: 'guitare', title: 'Guitare' }));
      s.addSub.execute.mockResolvedValueOnce(ok({ id: 'accords', title: 'Accords' }));

      s.store.createObjective({ title: 'Guitare' });
      const objectiveId = s.store.objectiveOptions()[1].valeur;
      s.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      await settle();

      expect(s.addSub.execute).toHaveBeenCalledWith({ parentObjectiveId: 'guitare', title: 'Accords', ownerId: 'lea' });
      expect(s.store.stageOptions('guitare')).toEqual([{ valeur: 'accords', libelle: 'Accords' }]);
    });

    it('un pas coché avant d’être enregistré est enregistré coché, avec son id définitif', async () => {
      s.addTask.execute.mockResolvedValueOnce(ok({ id: 'p1', title: 'Un', importance: 3, urgency: 3 }));
      s.toggle.execute.mockResolvedValueOnce(ok({}));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      const temporaryId = s.store.tasks()[2].id;
      s.store.updateTaskDone({ taskId: temporaryId, done: true });
      await settle();

      expect(s.toggle.execute).toHaveBeenCalledWith({ taskId: 'p1', done: true });
      expect(task('p1')?.done).toBe(true);
    });

    it('un geste sur un pas dont l’ajout n’a pas abouti ne part pas, et ne masque pas le premier signalement', async () => {
      s.addTask.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      const temporaryId = s.store.tasks()[2].id;
      s.store.updateTaskDone({ taskId: temporaryId, done: true });
      s.store.moveTaskToQuadrant(temporaryId, 'laisser-filer');
      await settle();

      expect(s.toggle.execute).not.toHaveBeenCalled();
      expect(s.editTask.execute).not.toHaveBeenCalled();
      expect(s.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.addTask);
    });

    it('une étape posée sur un objectif dont la création n’a pas abouti disparaît avec lui', async () => {
      s.create.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));

      s.store.createObjective({ title: 'Guitare' });
      const objectiveId = s.store.objectiveOptions()[1].valeur;
      s.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      await settle();

      expect(s.addSub.execute).not.toHaveBeenCalled();
      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance']);
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.createObjective);
      expect(s.store.isPending()).toBe(false);
    });
  });

  describe('objectivesLoaded : la mémoire du chargement', () => {
    it('vrai une fois chargé, et il le reste quand une écriture passe par requestStatus', async () => {
      expect(s.store.objectivesLoaded()).toBe(true);
      s.create.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_OBJECTIVE'));
      s.store.createObjective({ title: 'Guitare' });
      expect(s.store.isPending()).toBe(true);
      expect(s.store.objectivesLoaded()).toBe(true);
      await settle();
      expect(s.store.error()).toBe(FAILURE_REPORTS.createObjective);
      expect(s.store.objectivesLoaded()).toBe(true);
    });

    it('faux pendant le premier chargement, et après un chargement qui n’aboutit pas', async () => {
      TestBed.resetTestingModule();
      const load = deferred<GetAllObjectiveAndTaskOutput>();
      const t = await setup(LOADED, load.promise);
      expect(t.store.isPending()).toBe(true);
      expect(t.store.objectivesLoaded()).toBe(false);

      load.resolve(structuredClone(LOADED));
      await settle();
      expect(t.store.objectivesLoaded()).toBe(true);

      t.store.clearObjectives(); // déconnexion
      expect(t.store.objectivesLoaded()).toBe(false);
      t.query.execute.mockRejectedValueOnce(new Error('réseau'));
      t.store.loadObjectives({ ownerId: 'lea' });
      await settle();
      expect(t.store.objectivesLoaded()).toBe(false);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });

  describe('le chargement garde les créations en vol', () => {
    it('le premier chargement garde l’objectif, l’étape et le pas encore optimistes', async () => {
      TestBed.resetTestingModule();
      const load = deferred<GetAllObjectiveAndTaskOutput>();
      const t = await setup(LOADED, load.promise);
      const created = deferred<unknown>();
      t.create.execute.mockReturnValueOnce(created.promise);
      t.addSub.execute.mockResolvedValueOnce(ok({ id: 'accords', title: 'Accords' }));
      t.addTask.execute.mockResolvedValueOnce(ok({ id: 'p1', title: 'Do, ré, mi', importance: 3, urgency: 2 }));

      // « Je m'y engage » avant la fin du premier chargement, puis une étape et un pas sur cet objectif
      t.store.createObjective({ title: 'Guitare' });
      const objectiveId = t.store.objectiveOptions()[0].valeur;
      t.store.addSubObjective({ objectiveId, subObjectiveTitle: 'Accords' });
      const stageId = t.store.stageOptions(objectiveId)[0].valeur;
      t.store.addTaskToObjective({ objectiveId: stageId, task: { title: 'Do, ré, mi', importance: 3, urgency: 2 } });
      await settle();
      // Les écritures attendent le chargement : elles partent après sa lecture de la base
      expect(t.create.execute).not.toHaveBeenCalled();

      load.resolve(structuredClone(LOADED));
      await settle();
      // Le chargement a remplacé l'état : les éléments optimistes sont toujours là, après les éléments chargés
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', objectiveId, stageId]);
      expect(t.store.tasks().map((item) => item.title)).toEqual(['Courir 8 km', 'Sortie longue', 'Do, ré, mi']);
      expect(t.store.tasks()[2]).toMatchObject({ objectiveId: stageId, done: false });
      expect(t.create.execute).toHaveBeenCalledTimes(1);

      created.resolve(ok({ id: 'guitare', title: 'Guitare' }));
      await settle();
      expect(temporaryIdsOf(t.store)).toEqual([]);
      expect(t.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare', 'accords']);
      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2', 'p1']);
      expect(t.store.objectiveDetail('guitare')?.stages[0].tasks.map((item) => item.id)).toEqual(['p1']);
      expect(t.store.lastCreatedObjectiveId()).toBe('guitare');
    });

    it('un objectif créé juste avant un rechargement n’est ni perdu ni en double', async () => {
      let saved = false;
      s.create.execute.mockImplementationOnce(async () => {
        saved = true;
        return ok({ id: 'guitare', title: 'Guitare' });
      });
      // La base, lue après l'écriture, contient le nouvel objectif
      s.query.execute.mockImplementationOnce(async () => ({
        objectives: [
          ...LOADED.objectives,
          ...(saved ? [{ id: 'guitare', title: 'Guitare', description: '', why: '', dueDate: null, parentObjective: null }] : []),
        ],
        tasks: LOADED.tasks,
      }));

      s.store.createObjective({ title: 'Guitare' });
      s.store.loadObjectives({ ownerId: 'lea' });
      await settle();

      expect(s.store.objectives().map((item) => item.id)).toEqual(['semi', 'endurance', 'guitare']);
      expect(s.create.execute.mock.invocationCallOrder[0]).toBeLessThan(s.query.execute.mock.invocationCallOrder[1]);
    });

    it('un pas coché pendant un rechargement reste coché : la base est relue après son écriture', async () => {
      // Une base simulée : ce que la coche enregistre, la lecture suivante le rend.
      let t1DoneInDb = false;
      s.toggle.execute.mockImplementation(async ({ done }: { done: boolean }) => {
        t1DoneInDb = done;
        return ok({});
      });
      s.query.execute.mockImplementation(async () => ({
        ...structuredClone(LOADED),
        tasks: LOADED.tasks.map((item) => (item.id === 't1' ? { ...item, done: t1DoneInDb } : item)),
      }));
      const reload = deferred<GetAllObjectiveAndTaskOutput>();
      s.query.execute.mockReturnValueOnce(reload.promise);

      // Le rechargement de fin de tour d'Akari lit la base ; la personne coche t1 pendant ce temps.
      s.store.loadObjectives({ ownerId: 'lea' });
      await settle();
      s.store.updateTaskDone({ taskId: 't1', done: true });
      expect(task('t1')?.done).toBe(true);

      // La lecture, faite avant l'écriture de la coche, rend t1 à faire : elle n'efface pas la coche.
      reload.resolve(structuredClone(LOADED));
      await settle();

      expect(s.toggle.execute).toHaveBeenCalledWith({ taskId: 't1', done: true });
      expect(t1DoneInDb).toBe(true);
      expect(task('t1')?.done).toBe(true);
      // Le premier chargement, le rechargement, puis une seule relecture.
      expect(s.query.execute).toHaveBeenCalledTimes(3);
      expect(s.store.isPending()).toBe(false);
      expect(s.store.error()).toBeNull();
    });

    it('un rechargement sans geste pendant sa lecture ne relit pas la base', async () => {
      s.store.loadObjectives({ ownerId: 'lea' });
      await settle();
      expect(s.query.execute).toHaveBeenCalledTimes(2);
    });

    it('un pas dont l’ajout n’aboutit pas après le chargement disparaît quand même', async () => {
      TestBed.resetTestingModule();
      const load = deferred<GetAllObjectiveAndTaskOutput>();
      const t = await setup(LOADED, load.promise);
      t.addTask.execute.mockResolvedValueOnce(ko('FAIL_TO_SAVE_TASK'));

      load.resolve(structuredClone(LOADED));
      t.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 2 } });
      await settle();

      expect(t.store.tasks().map((item) => item.id)).toEqual(['t1', 't2']);
      expect(t.annonces.signalement()).toBe(FAILURE_REPORTS.addTask);
    });
  });

  describe('les annonces', () => {
    it('annonce chaque réussite', async () => {
      s.toggle.execute.mockResolvedValue(ok({}));
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      await settle();
      expect(s.announce.mock.calls).toEqual([
        [SUCCESS_ANNOUNCEMENTS.taskDone, 'polite'],
        [SUCCESS_ANNOUNCEMENTS.taskUndone, 'polite'],
      ]);
    });

    it('signale un chargement qui n’aboutit pas', async () => {
      s.query.execute.mockRejectedValueOnce(new Error('réseau'));
      s.store.loadObjectives({ ownerId: 'lea' });
      await settle();
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.loadObjectives);
      expect(s.store.error()).toBe(FAILURE_REPORTS.loadObjectives);
    });
  });
});

describe('la voix : tout ce qui est passé à annoncer() et signaler()', () => {
  /** Chaque action, dans chacune de ses issues : réussite, échec du domaine (avec ses codes), exception. */
  type Outcome = 'success' | 'FAIL' | 'OBJECTIVE_NOT_FOUND' | 'TASK_NOT_FOUND' | 'throw';
  const OUTCOMES: Outcome[] = ['success', 'FAIL', 'OBJECTIVE_NOT_FOUND', 'TASK_NOT_FOUND', 'throw'];

  const answer = (mock: Mock, outcome: Outcome, data: unknown) => {
    if (outcome === 'success') mock.execute.mockResolvedValue(ok(data));
    else if (outcome === 'throw') mock.execute.mockRejectedValue(new Error(DOMAIN_MESSAGE));
    else mock.execute.mockResolvedValue(ko(outcome));
  };

  it('chaque phrase parle comme Empreinte, et aucun message technique du domaine ne passe', async () => {
    const texts = new Set<string>();

    for (const outcome of OUTCOMES) {
      TestBed.resetTestingModule();
      const s = await setup();
      answer(s.create, outcome, { id: 'o1', title: 'Guitare' });
      answer(s.addSub, outcome, { id: 'e1', title: 'Accords' });
      answer(s.addTask, outcome, { id: 'p1', title: 'Un', importance: 3, urgency: 3 });
      answer(s.editObjective, outcome, {});
      answer(s.editTask, outcome, {});
      answer(s.toggle, outcome, {});

      s.store.createObjective({ title: 'Guitare' });
      s.store.addSubObjective({ objectiveId: 'semi', subObjectiveTitle: 'Accords' });
      s.store.addTaskToObjective({ objectiveId: 'endurance', task: { title: 'Un', importance: 3, urgency: 3 } });
      s.store.editObjective({ id: 'semi', title: 'Semi en mai' });
      s.store.editTask({ taskId: 't1', input: { title: 'Courir 10 km', importance: 4, urgency: 1, objectiveId: 'endurance' } });
      s.store.updateTaskDone({ taskId: 't1', done: true });
      s.store.updateTaskDone({ taskId: 't2', done: false });
      for (const quadrant of QUADRANTS) s.store.moveTaskToQuadrant('t2', quadrant);
      if (outcome === 'throw') {
        s.query.execute.mockRejectedValueOnce(new Error(DOMAIN_MESSAGE));
        s.store.loadObjectives({ ownerId: 'lea' });
      }
      await settle();

      for (const [text] of s.announce.mock.calls) texts.add(text as string);
    }

    // Toutes les phrases de messages.constante.ts sont passées au moins une fois
    expect([...texts]).toEqual(expect.arrayContaining([
      ...Object.values(SUCCESS_ANNOUNCEMENTS),
      ...Object.values(FAILURE_REPORTS),
      ...QUADRANTS.map(taskMovedAnnouncement),
    ]));
    for (const text of texts) {
      expect(voiceIssues(text), text).toEqual([]);
      expect(text).not.toContain(DOMAIN_MESSAGE);
      expect(text).not.toMatch(/[A-Z_]{6,}/); // aucun code d'erreur
    }
  });
});

describe('déplacer un pas vers un quadrant : les 16 cas de départ et d’arrivée, niveaux de 1 à 5', () => {
  const CATEGORY_OF: Record<Quadrant, EisenhowerCategory> = {
    maintenant: EisenhowerCategory.DO,
    planifier: EisenhowerCategory.SCHEDULE,
    confier: EisenhowerCategory.DELEGATE,
    'laisser-filer': EisenhowerCategory.DELETE,
  };
  const QUADRANT_OF = Object.fromEntries(Object.entries(CATEGORY_OF).map(([q, c]) => [c, q])) as Record<EisenhowerCategory, Quadrant>;
  const WANTS: Record<Quadrant, { important: boolean; urgent: boolean }> = {
    maintenant: { important: true, urgent: true },
    planifier: { important: true, urgent: false },
    confier: { important: false, urgent: true },
    'laisser-filer': { important: false, urgent: false },
  };

  /** Un pas pour chaque couple (importance, urgence) de 1 à 5. */
  const TASKS: TaskOutput[] = [];
  for (let importance = 1; importance <= 5; importance++)
    for (let urgency = 1; urgency <= 5; urgency++)
      TASKS.push({ id: `t-${importance}-${urgency}`, title: `Pas ${importance}/${urgency}`, importance, urgency, done: urgency === 5, objectiveId: 'endurance' });
  const loaded: GetAllObjectiveAndTaskOutput = { objectives: LOADED.objectives, tasks: TASKS };
  const quadrantOf = (levels: { importance: number; urgency: number }) => QUADRANT_OF[ApexLibsMetier.getEisenhowerCategory(levels)];

  it('couvre bien les 16 couples (quadrant de départ, quadrant d’arrivée)', () => {
    const pairs = new Set(TASKS.flatMap((item) => QUADRANTS.map((to) => `${quadrantOf(item)}→${to}`)));
    expect(pairs.size).toBe(16);
  });

  it.each(QUADRANTS)('vers « %s » : le pas y retombe selon ApexLibsMetier, seul l’axe nécessaire change', async (to) => {
    const s = await setup(loaded);
    s.editTask.execute.mockResolvedValue(ok({}));

    for (const item of TASKS) s.store.moveTaskToQuadrant(item.id, to);
    // Optimiste : tout est déjà en place avant toute réponse
    for (const item of TASKS) {
      const moved = s.store.tasks().find((t) => t.id === item.id);
      expect(moved && ApexLibsMetier.getEisenhowerCategory(moved), item.id).toBe(CATEGORY_OF[to]);
    }
    await settle();

    const sent = new Map(s.editTask.execute.mock.calls.map(([input]) => [input.task.id, input.task]));
    for (const item of TASKS) {
      const from = quadrantOf(item);
      const moved = s.store.tasks().find((t) => t.id === item.id);
      if (!moved) throw new Error(item.id);
      expect(ApexLibsMetier.getEisenhowerCategory(moved), `${item.id} ${from}→${to}`).toBe(CATEGORY_OF[to]);
      expect(s.store.matrix()[to].some((t) => t.id === item.id)).toBe(true);
      expect(moved.done).toBe(item.done);

      if (from === to) {
        expect(sent.has(item.id), `${item.id} ne doit pas partir`).toBe(false);
        expect(moved).toMatchObject({ importance: item.importance, urgency: item.urgency });
        continue;
      }
      expect(sent.get(item.id)).toEqual({ id: item.id, title: item.title, objectiveId: 'endurance', importance: moved.importance, urgency: moved.urgency });
      // Seul ce qui doit changer change : sous 3 → 3, 3 ou plus → 2
      const wants = WANTS[to];
      expect(moved.importance).toBe(wants.important === item.importance >= 3 ? item.importance : wants.important ? 3 : 2);
      expect(moved.urgency).toBe(wants.urgent === item.urgency >= 3 ? item.urgency : wants.urgent ? 3 : 2);
    }
    expect(sent.size).toBe(TASKS.filter((item) => quadrantOf(item) !== to).length);
    expect(s.annonces.signalement()).toBeNull();
  });

  it('revient en arrière dans les 16 cas si l’enregistrement n’aboutit pas', async () => {
    for (const to of QUADRANTS) {
      TestBed.resetTestingModule();
      const s = await setup(loaded);
      s.editTask.execute.mockResolvedValue(ko('FAIL_TO_SAVE_TASK'));
      for (const item of TASKS) s.store.moveTaskToQuadrant(item.id, to);
      await settle();
      for (const item of TASKS)
        expect(s.store.tasks().find((t) => t.id === item.id), `${item.id} → ${to}`).toMatchObject({
          importance: item.importance,
          urgency: item.urgency,
          done: item.done,
        });
      expect(s.annonces.signalement()).toBe(FAILURE_REPORTS.moveTask);
    }
  });
});
