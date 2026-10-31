import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { signalStore, withState } from '@ngrx/signals';
import { ObjectivesApi } from '../../api/objectives.api';
import { ApiError } from '../../api/api-error';
import { SessionStore } from '../session.store';
import { AnnoncesStore } from '../annonces.store';
import { withRequestStatus } from '../utils/loading-feature';
import type { ObjectiveState } from '../objective.store';
import { withMoveTaskToQuadrant } from './with-move-task-to-quadrant';
import { withCreateObjective } from './with-create-objective';
import { FAILURE_REPORTS, SUCCESS_ANNOUNCEMENTS } from '../../constants/messages.constante';

const initialState: ObjectiveState = {
  objectives: [{ id: 'semi', title: 'Semi-marathon', why: '', description: '', dueDate: '', parentId: null }],
  tasks: [
    { id: 't1', title: 'Courir 8 km', importance: 4, urgency: 1, done: false, objectiveId: 'semi' },
    { id: 't2', title: 'Comparer des montres', importance: 1, urgency: 1, done: true, objectiveId: 'semi' },
  ],
};

const TestStore = signalStore(
  withState<ObjectiveState>(initialState),
  withRequestStatus(),
  withCreateObjective(),
  withMoveTaskToQuadrant(),
);

/** Laisse les promesses de l'API se résoudre. */
const settle = async () => {
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setTimeout(resolve));
};

describe('ObjectiveStore — déplacer un pas, créer un objectif', () => {
  let api: { editTask: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let announce: ReturnType<typeof vi.fn>;
  let store: InstanceType<typeof TestStore>;
  let annonces: InstanceType<typeof AnnoncesStore>;

  beforeEach(() => {
    api = { editTask: vi.fn(), create: vi.fn() };
    announce = vi.fn().mockResolvedValue(undefined);
    TestBed.configureTestingModule({
      providers: [
        TestStore,
        { provide: ObjectivesApi, useValue: api },
        { provide: SessionStore, useValue: { isAuthenticated: signal(true), currentUserId: signal('lea') } },
        { provide: LiveAnnouncer, useValue: { announce } },
      ],
    });
    store = TestBed.inject(TestStore);
    annonces = TestBed.inject(AnnoncesStore);
  });

  it('déplace le pas tout de suite, persiste par la modification du pas (PATCH /v1/tasks/{id}), puis l’annonce', async () => {
    api.editTask.mockResolvedValue({ id: 't1', title: 'Courir 8 km', objectiveId: 'semi', importance: 4, urgency: 3 });

    store.moveTaskToQuadrant('t1', 'maintenant');

    expect(store.tasks()[0]).toMatchObject({ importance: 4, urgency: 3 });
    await settle();
    // L'écriture part depuis la file d'écritures, au tour suivant
    expect(api.editTask).toHaveBeenCalledWith('t1', { title: 'Courir 8 km', objectiveId: 'semi', importance: 4, urgency: 3 });
    expect(store.tasks()[0]).toMatchObject({ importance: 4, urgency: 3 });
    expect(announce).toHaveBeenCalledWith('Ce pas passe dans « Maintenant ».', 'polite');
    expect(annonces.signalement()).toBeNull();
  });

  it('revient en arrière et le signale si l’enregistrement n’aboutit pas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.editTask.mockRejectedValue(new ApiError('FAIL_TO_SAVE_TASK', 500, 'Failed'));

    store.moveTaskToQuadrant('t1', 'confier');
    expect(store.tasks()[0]).toMatchObject({ importance: 2, urgency: 3 });

    await settle();
    expect(store.tasks()[0]).toMatchObject({ importance: 4, urgency: 1 });
    expect(annonces.signalement()).toBe(FAILURE_REPORTS.moveTask);
  });

  it('revient en arrière si l’API ne répond pas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.editTask.mockRejectedValue(new ApiError('NETWORK_ERROR', 0, 'Http failure response'));

    store.moveTaskToQuadrant('t2', 'maintenant');
    await settle();

    expect(store.tasks()[1]).toMatchObject({ importance: 1, urgency: 1, done: true });
    expect(annonces.signalement()).toBe(FAILURE_REPORTS.moveTask);
  });

  it('ne fait rien pour un pas déjà dans ce quadrant, ou inconnu', async () => {
    store.moveTaskToQuadrant('t1', 'planifier');
    store.moveTaskToQuadrant('inconnu', 'maintenant');
    await settle();
    expect(api.editTask).not.toHaveBeenCalled();
    expect(store.tasks()).toEqual(initialState.tasks);
  });

  it('donne l’id définitif du nouvel objectif une fois enregistré', async () => {
    api.create.mockResolvedValue({ id: 'stage-web', title: 'Décrocher un stage' });

    store.createObjective({ title: 'Décrocher un stage' });
    expect(store.lastCreatedObjectiveId()).toBeNull();
    expect(store.objectives().some((objective) => objective.id.startsWith('temp-id-'))).toBe(true);

    await settle();
    expect(store.lastCreatedObjectiveId()).toBe('stage-web');
    expect(store.objectives().map((objective) => objective.id)).toEqual(['semi', 'stage-web']);
    expect(announce).toHaveBeenCalledWith(SUCCESS_ANNOUNCEMENTS.objectiveCreated, 'polite');
  });

  it('retire l’objectif optimiste et le signale si la création n’aboutit pas', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    api.create.mockRejectedValue(new ApiError('FAIL_TO_SAVE_OBJECTIVE', 500, 'Failed'));

    store.createObjective({ title: 'Décrocher un stage' });
    await settle();

    expect(store.lastCreatedObjectiveId()).toBeNull();
    expect(store.objectives().map((objective) => objective.id)).toEqual(['semi']);
    expect(store.error()).toBe(FAILURE_REPORTS.createObjective);
    expect(annonces.signalement()).toBe(FAILURE_REPORTS.createObjective);
  });
});
