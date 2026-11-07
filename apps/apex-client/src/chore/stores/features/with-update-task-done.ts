import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, from, mergeMap } from "rxjs";
import { inject } from "@angular/core";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { tapResponse } from "@ngrx/operators";
import { AnnoncesStore } from "../annonces.store";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { replaceFieldsIfShown } from "../utils/command-fields";
import { forgetTask } from "../utils/forget";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export function withUpdateTaskDone() {
  return signalStoreFeature(
    { state: type<ObjectiveState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>{
      /** Le pas montre `next` à la place de `shown`, sauf si un geste plus récent l'a déjà changé. */
      const replaceDone = (taskId: string, shown: boolean, next: boolean) =>
        patchState(store, { tasks: replaceFieldsIfShown(store.tasks(), writes.resolve(taskId), { done: shown }, { done: next }) });

      /**
       * Coche (completeTask) ou décoche (reopenTask) un pas, d'abord dans l'état puis par l'API, qui rend le pas ;
       * retour en arrière si elle refuse ; un pas qu'elle ne connaît plus quitte l'écran. Le « fait » de l'étape et de l'objectif n'est pas relu : c'est l'API qui
       * le dit, à la prochaine lecture. Sans réponse claire, l'API a pu cocher le pas : on relit.
       */
      const updateTaskDone = rxMethod<{ taskId: string; done: boolean }>(
          pipe(
            tap(({ taskId, done }) => replaceDone(taskId, !done, done)),
            mergeMap(({ taskId, done }) =>
              from(writes.run(async () => {
                const id = writes.resolve(taskId);
                if (isTemporaryId(id)) return null; // son ajout n'a pas abouti (déjà signalé)
                return done ? objectivesApi.completeTask(id) : objectivesApi.reopenTask(id);
              })).pipe(
                tapResponse({
                  next: (saved)=> {
                    if (saved === null) return;
                    replaceDone(taskId, done, saved.done);
                    annonces.annoncer(done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone);
                  },
                  error: (error) => {
                    console.error('Mise à jour du pas non enregistrée :', error);
                    annonces.signaler(failureReport('toggleTask', errorCodeOf(error)));
                    if (errorCodeOf(error) === 'TASK_NOT_FOUND') {
                      patchState(store, { tasks: forgetTask(store.tasks(), writes.resolve(taskId)) });
                      return;
                    }
                    replaceDone(taskId, done, !done);
                    if (isUnknownOutcome(error)) store.loadObjectives();
                  }
                })
              )
            )
          )
        );

      return { updateTaskDone };
    })
  );
}
