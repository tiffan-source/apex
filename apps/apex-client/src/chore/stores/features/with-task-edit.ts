import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { filter, from, map, mergeMap, pipe, tap } from "rxjs";
import { RequestStatusState } from "../utils/loading-feature";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { EditMyTaskUsecase } from "@org/objective";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { withOwnerId } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { tapResponse } from "@ngrx/operators";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type EditTaskInput = {
  title: string;
  importance: number;
  urgency: number;
  /** L'objectif ou l'étape qui porte le pas (le changer déplace le pas). */
  objectiveId: string;
};

export function withTaskEdit() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((
      store,
      editMyTaskUsecase = inject(EditMyTaskUsecase),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      /**
       * Remet le pas tel qu'il était avant la modification optimiste (son « fait » actuel est gardé),
       * sauf si un geste plus récent l'a déjà changé.
       */
      const restore = (oldTask: TaskViewModel, input: EditTaskInput) => {
        const id = writes.resolve(oldTask.id);
        const inputObjectiveId = writes.resolve(input.objectiveId);
        patchState(store, {
          tasks: store.tasks().map((task) =>
            task.id === id &&
            task.title === input.title &&
            task.importance === input.importance &&
            task.urgency === input.urgency &&
            writes.resolve(task.objectiveId) === inputObjectiveId
              ? { ...oldTask, id, objectiveId: writes.resolve(oldTask.objectiveId), done: task.done }
              : task
          )
        });
      };

      return {
        /** Modifie un pas, d'abord dans l'état puis en base ; retour en arrière si l'enregistrement n'aboutit pas. */
        editTask: rxMethod<{ taskId: string; input: EditTaskInput }>(
          pipe(
            withOwnerId(sessionStore.currentUserId),
            map(data => ({...data, oldTask: store.tasks().find(task => task.id === data.taskId)})),
            // Rien à modifier si le pas n'est pas (ou plus) chargé
            filter((data): data is typeof data & { oldTask: TaskViewModel } => data.oldTask !== undefined),
            tap(({ taskId, input, oldTask }) => {
              patchState(store, { requestStatus: 'pending' });

              const updatedTask: TaskViewModel = {
                id: taskId,
                title: input.title,
                importance: input.importance,
                urgency: input.urgency,
                done: oldTask.done,
                objectiveId: input.objectiveId
              };

              patchState(store, {
                tasks: store.tasks().map((task) => task.id === taskId ? updatedTask : task)
              });
            }),
            mergeMap(({input, oldTask, taskId, ownerId})=>
              from(writes.run(async () => {
                const id = writes.resolve(taskId);
                const objectiveId = writes.resolve(input.objectiveId);
                if (isTemporaryId(id) || isTemporaryId(objectiveId)) return null; // une création n'a pas abouti (déjà signalé)
                return editMyTaskUsecase.execute({
                  ownerId,
                  task: { id, title: input.title, importance: input.importance, urgency: input.urgency, objectiveId }
                });
              })).pipe(
                tapResponse({
                  next: (data) => {
                    if (data === null) {
                      restore(oldTask, input);
                      patchState(store, { requestStatus: 'idle' });
                    } else if(data.success) {
                      patchState(store, { requestStatus: 'fulfilled' });
                      annonces.annoncer(SUCCESS_ANNOUNCEMENTS.taskSaved);
                    }else{
                      const report = failureReport('editTask', data.error.code);
                      patchState(store, { requestStatus: { error: report } });
                      annonces.signaler(report);
                      restore(oldTask, input);
                    }
                  },
                  error: (error) => {
                    console.error(error);
                    const report = failureReport('editTask');
                    annonces.signaler(report);
                    patchState(store, { requestStatus: { error: report } });
                    restore(oldTask, input);
                  }
                })
              )
            )
          )
        )
      };
    })
  );
}
