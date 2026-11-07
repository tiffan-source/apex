import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { Observable, catchError, filter, forkJoin, from, map, mergeMap, of, pipe, tap } from "rxjs";
import { RequestStatusState } from "../utils/loading-feature";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { ObjectivesApi } from "../../api/objectives.api";
import type { TaskEntity } from "../../api/api.models";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { pickFields, replaceFieldsIfShown, type SameValue } from "../utils/command-fields";
import { forgetObjective, forgetTask } from "../utils/forget";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type EditTaskInput = {
  title: string;
  importance: number;
  urgency: number;
  /** L'objectif ou l'étape qui porte le pas (le changer déplace le pas). */
  objectiveId: string;
};

/** Ce que modifier un pas change, une commande par intention. */
type TaskCommand = {
  fields: readonly (keyof TaskViewModel)[];
  send: (taskId: string, objectiveId: string) => Promise<TaskEntity> | null;
};

export function withTaskEdit() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      // L'étape d'un pas a pu être enregistrée entre-temps : son id temporaire et son id définitif sont la même.
      const same: SameValue = (field, a, b) =>
        field === 'objectiveId' ? writes.resolve(a as string) === writes.resolve(b as string) : a === b;

      const replace = (taskId: string, shown: Partial<TaskViewModel>, next: Partial<TaskViewModel>) =>
        patchState(store, { tasks: replaceFieldsIfShown(store.tasks(), writes.resolve(taskId), shown, next, same) });

      /** Les commandes du geste : seulement ce qui a changé, dans l'ordre renommer, reprioriser, déplacer. */
      const commandsFor = (oldTask: TaskViewModel, input: EditTaskInput): TaskCommand[] => {
        const commands: TaskCommand[] = [];
        if (input.title !== oldTask.title) {
          commands.push({ fields: ['title'], send: (id) => objectivesApi.renameTask(id, input.title) });
        }
        if (input.importance !== oldTask.importance || input.urgency !== oldTask.urgency) {
          commands.push({
            fields: ['importance', 'urgency'],
            send: (id) => objectivesApi.reprioritizeTask(id, input.importance, input.urgency),
          });
        }
        if (writes.resolve(input.objectiveId) !== writes.resolve(oldTask.objectiveId)) {
          commands.push({
            fields: ['objectiveId'],
            // L'étape choisie n'a pas été enregistrée : le déplacement ne part pas (déjà signalé).
            send: (id, objectiveId) => (isTemporaryId(objectiveId) ? null : objectivesApi.moveTask(id, objectiveId)),
          });
        }
        return commands;
      };

      /**
       * Une commande dans la file d'écritures. L'API accepte : le pas prend ce qu'elle rend pour ces champs.
       * Elle refuse : ces champs seuls reviennent en arrière, le reste du geste garde sa chance. Rend vrai si
       * la commande est acceptée.
       */
      const run = (taskId: string, oldTask: TaskViewModel, shown: TaskViewModel, command: TaskCommand): Observable<boolean> =>
        from(writes.run(async () => {
          const id = writes.resolve(taskId);
          if (isTemporaryId(id)) return null; // son ajout n'a pas abouti (déjà signalé)
          return command.send(id, writes.resolve(shown.objectiveId));
        })).pipe(
          map((saved) => {
            const fieldsShown = pickFields(shown, command.fields);
            if (saved === null) {
              replace(taskId, fieldsShown, pickFields(oldTask, command.fields));
              return false;
            }
            replace(taskId, fieldsShown, pickFields(ObjectiveMapper.toTaskViewModel(saved), command.fields));
            return true;
          }),
          catchError((error: unknown) => {
            console.error(error);
            const code = errorCodeOf(error);
            const report = failureReport('editTask', code);
            annonces.signaler(report);
            patchState(store, { requestStatus: { error: report } });
            if (code === 'TASK_NOT_FOUND') {
              patchState(store, { tasks: forgetTask(store.tasks(), writes.resolve(taskId)) });
            } else if (code === 'OBJECTIVE_NOT_FOUND' && command.fields.includes('objectiveId')) {
              // L'étape choisie n'existe plus : le pas revient où il était, elle quitte l'écran.
              replace(taskId, pickFields(shown, command.fields), pickFields(oldTask, command.fields));
              patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, writes.resolve(shown.objectiveId)));
            } else {
              replace(taskId, pickFields(shown, command.fields), pickFields(oldTask, command.fields));
              if (isUnknownOutcome(error)) store.loadObjectives();
            }
            return of(false);
          }),
        );

      return {
        /**
         * Modifie un pas, d'abord dans l'état puis par l'API, une commande par intention (renameTask,
         * reprioritizeTask, moveTask), seulement pour ce qui a changé. Chacune est acceptée ou revient en
         * arrière seule ; l'arbre n'est relu que si l'issue de l'une d'elles est inconnue.
         */
        editTask: rxMethod<{ taskId: string; input: EditTaskInput }>(
          pipe(
            whenSignedIn(sessionStore.isAuthenticated),
            map(data => ({...data, oldTask: store.tasks().find(task => task.id === data.taskId)})),
            // Rien à modifier si le pas n'est pas (ou plus) chargé
            filter((data): data is typeof data & { oldTask: TaskViewModel } => data.oldTask !== undefined),
            map((data) => ({ ...data, commands: commandsFor(data.oldTask, data.input) })),
            filter(({ commands }) => commands.length > 0),
            map(({ taskId, input, oldTask, commands }) => {
              const shown: TaskViewModel = {
                ...oldTask,
                title: input.title,
                importance: input.importance,
                urgency: input.urgency,
                // L'étape choisie a pu être enregistrée pendant que la feuille était ouverte : son id définitif
                // (sinon le pas resterait rattaché à un id temporaire qui n'existe plus dans l'état).
                objectiveId: writes.resolve(input.objectiveId),
              };
              return { taskId, oldTask, shown, commands };
            }),
            tap(({ taskId, shown }) => {
              patchState(store, {
                requestStatus: 'pending',
                tasks: store.tasks().map((task) => (task.id === taskId ? { ...shown, done: task.done } : task)),
              });
            }),
            mergeMap(({ taskId, oldTask, shown, commands }) =>
              // Les commandes entrent dans la file tout de suite, dans l'ordre ; forkJoin attend la réponse de chacune.
              forkJoin(commands.map((command) => run(taskId, oldTask, shown, command))).pipe(
                tap((accepted) => {
                  if (!accepted.every(Boolean)) {
                    if (store.requestStatus() === 'pending') patchState(store, { requestStatus: 'idle' });
                    return;
                  }
                  patchState(store, { requestStatus: 'fulfilled' });
                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.taskSaved);
                }),
              )
            )
          )
        )
      };
    })
  );
}
