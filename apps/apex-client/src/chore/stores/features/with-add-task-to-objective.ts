import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { AddTaskToObjectiveUsecase } from "@org/objective";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { withOwnerId } from "../utils/filter-auth-operation";
import { isTemporaryId, swapTaskId, withOptimistiqueId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type TaskQuery = {
  title: string;
  importance: number;
  urgency: number;
}

export function withAddTaskToObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((store,
      addTaskToObjectiveUsecase = inject(AddTaskToObjectiveUsecase),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>({
      /** Ajoute un pas à un objectif ou à une étape (objectiveId), d'abord dans l'état puis en base. */
      addTaskToObjective: rxMethod<{ objectiveId: string; task: TaskQuery }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          withOptimistiqueId(),
          tap(({ objectiveId, task, tempId }) => {
            patchState(store, { requestStatus: 'pending' });

            const newTask: TaskViewModel = {
              id: tempId,
              title: task.title,
              importance: task.importance,
              urgency: task.urgency,
              done: false,
              objectiveId: objectiveId,
            };

            patchState(store, {
              tasks: [...store.tasks(), newTask],
            });
          }),
          mergeMap(({ objectiveId, task, ownerId, tempId }) =>
            from(writes.run(async () => {
              // L'étape a pu être enregistrée entre-temps : son id définitif est connu ici
              const targetId = writes.resolve(objectiveId);
              if (isTemporaryId(targetId)) return null; // sa création n'a pas abouti (déjà signalé)
              return addTaskToObjectiveUsecase.execute(targetId, { ...task, ownerId });
            })).pipe(
              tapResponse({
                next: (data) => {
                  if (data === null) {
                    patchState(store, { tasks: store.tasks().filter((t) => t.id !== tempId), requestStatus: 'idle' });
                  } else if (data.success) {
                    writes.link(tempId, data.data.id);
                    patchState(store, {
                      // Le pas garde son état optimiste (coché, déplacé…) : ces gestes partent ensuite dans la file
                      tasks: swapTaskId(store.tasks(), tempId, data.data.id),
                      requestStatus: 'fulfilled'
                    });

                    annonces.annoncer(SUCCESS_ANNOUNCEMENTS.taskAdded);
                  } else {
                    const report = failureReport('addTask', data.error.code);
                    annonces.signaler(report);
                    patchState(store, {
                      tasks: store.tasks().filter((t) => t.id !== tempId),
                      requestStatus: { error: report }
                    });
                  }
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('addTask');
                  annonces.signaler(report);
                  patchState(store, {
                    tasks: store.tasks().filter((t) => t.id !== tempId),
                    requestStatus: { error: report }
                  });
                },
              })
            )
          )
        )
      )
    }))
  )
}
