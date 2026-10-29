import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, from, mergeMap } from "rxjs";
import { inject } from "@angular/core";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { tapResponse } from "@ngrx/operators";
import { AnnoncesStore } from "../annonces.store";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export function withUpdateTaskDone() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>{
      const setDone = (taskId: string, done: boolean) =>
        patchState(store, (state) => ({
          ...state,
          tasks: state.tasks.map((task) => task.id === taskId ? { ...task, done } : task)
        }));

      /** Retour à l'état précédent, sauf si un geste plus récent a déjà changé le pas. */
      const restore = (taskId: string, done: boolean) => {
        const id = writes.resolve(taskId);
        if (store.tasks().find((task) => task.id === id)?.done === done) setDone(id, !done);
      };

      /** Coche ou décoche un pas, d'abord dans l'état puis par l'API ; retour en arrière si l'enregistrement n'aboutit pas. */
      const updateTaskDone = rxMethod<{ taskId: string; done: boolean }>(
          pipe(
            // Mise à jour optimiste
            tap(({ taskId, done }) => setDone(taskId, done)),
            mergeMap(({ taskId, done }) =>
              from(writes.run(async () => {
                const id = writes.resolve(taskId);
                if (isTemporaryId(id)) return null; // son ajout n'a pas abouti (déjà signalé)
                return objectivesApi.setTaskDone(id, done);
              })).pipe(
                tapResponse({
                  next: (saved)=> {
                    if (saved === null) return;
                    annonces.annoncer(done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone);
                  },
                  error: (error) => {
                    console.error('Mise à jour du pas non enregistrée :', error);
                    annonces.signaler(failureReport('toggleTask', errorCodeOf(error)));
                    restore(taskId, done);
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
