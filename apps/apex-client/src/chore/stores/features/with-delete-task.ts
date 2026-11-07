import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { tapResponse } from "@ngrx/operators";
import { inject } from "@angular/core";
import { filter, from, map, mergeMap, pipe, tap } from "rxjs";
import { ObjectiveState } from "../objective.store";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { removeWhere, restoreRemoved } from "../utils/removed-items";
import { failureReport } from "../../constants/messages.constante";

/**
 * Effacer un pas, pour de bon. L'écran a déjà posé sa trace (« Remettre ») : ce geste-ci part quand elle expire,
 * et l'écran n'a plus rien à dire de la réussite.
 */
export function withDeleteTask() {
  return signalStoreFeature(
    { state: type<ObjectiveState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => ({
      /**
       * Retire le pas de l'état, puis l'efface par l'API ; s'il n'est pas effacé, il revient à sa place. Un pas qui
       * n'est plus dans l'état (déjà effacé, ou parti avec son étape) est ignoré : l'effacement peut être demandé
       * plusieurs fois pour le même pas. Un pas déjà effacé côté serveur (404) l'est : rien à signaler.
       */
      deleteTask: rxMethod<string>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          map((taskId) => ({ taskId, ...removeWhere(store.tasks(), (task) => task.id === taskId) })),
          filter(({ removed }) => removed.length > 0),
          tap(({ kept }) => patchState(store, { tasks: kept })),
          mergeMap(({ taskId, removed }) =>
            from(writes.run(async () => {
              const id = writes.resolve(taskId);
              if (isTemporaryId(id)) return null; // son ajout n'a pas abouti (déjà signalé) : rien en base
              try {
                await objectivesApi.deleteTask(id);
              } catch (error) {
                if (errorCodeOf(error) !== 'TASK_NOT_FOUND') throw error;
              }
              return id;
            })).pipe(
              tapResponse({
                next: (deleted) => {
                  // Sans ce pas, son étape peut être faite : c'est l'API qui le dit.
                  if (deleted !== null) store.loadObjectives();
                },
                error: (error) => {
                  console.error('Pas non effacé :', error);
                  annonces.signaler(failureReport('eraseTask', errorCodeOf(error)));
                  // Il revient à sa place, sauf si son étape est partie entre-temps : il n'aurait plus où aller.
                  const objectiveIds = new Set(store.objectives().map((objective) => objective.id));
                  const back = removed.filter(({ item }) => objectiveIds.has(writes.resolve(item.objectiveId)));
                  patchState(store, {
                    tasks: restoreRemoved(store.tasks(), back, (task) => ({
                      ...task,
                      id: writes.resolve(task.id),
                      objectiveId: writes.resolve(task.objectiveId),
                    })),
                  });
                },
              })
            )
          )
        )
      ),
    }))
  );
}
