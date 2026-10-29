import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { whenSignedIn } from "../utils/filter-auth-operation";
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
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>({
      /** Ajoute un pas à un objectif ou à une étape (objectiveId), d'abord dans l'état puis par l'API. */
      addTaskToObjective: rxMethod<{ objectiveId: string; task: TaskQuery }>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          withOptimistiqueId(),
          tap(({ objectiveId, task, tempId }) => {
            patchState(store, { requestStatus: 'pending' });

            const newTask: TaskViewModel = {
              id: tempId,
              title: task.title,
              importance: task.importance,
              urgency: task.urgency,
              done: false,
              // L'étape a pu être enregistrée pendant que la feuille était ouverte (avec son id temporaire) :
              // le pas va à son id définitif, sinon il resterait rattaché à un id qui n'existe plus dans l'état.
              // Encore temporaire, swapObjectiveId le fera suivre à l'enregistrement.
              objectiveId: writes.resolve(objectiveId),
            };

            patchState(store, {
              tasks: [...store.tasks(), newTask],
            });
          }),
          mergeMap(({ objectiveId, task, tempId }) =>
            from(writes.run(async () => {
              // L'étape a pu être enregistrée entre-temps : son id définitif est connu ici
              const targetId = writes.resolve(objectiveId);
              if (isTemporaryId(targetId)) return null; // sa création n'a pas abouti (déjà signalé)
              return objectivesApi.addTask(targetId, { title: task.title, importance: task.importance, urgency: task.urgency });
            })).pipe(
              tapResponse({
                next: (created) => {
                  if (created === null) {
                    patchState(store, { tasks: store.tasks().filter((t) => t.id !== tempId), requestStatus: 'idle' });
                    return;
                  }
                  writes.link(tempId, created.id);
                  patchState(store, {
                    // Le pas garde son état optimiste (coché, déplacé…) : ces gestes partent ensuite dans la file
                    tasks: swapTaskId(store.tasks(), tempId, created.id),
                    requestStatus: 'fulfilled'
                  });

                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.taskAdded);
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('addTask', errorCodeOf(error));
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
