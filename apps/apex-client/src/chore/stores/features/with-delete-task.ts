import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { ObjectiveState } from "../objective.store";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { removeWhere, restoreRemoved } from "../utils/removed-items";

/**
 * Effacer un pas, pour de bon. L'écran a déjà posé sa trace (« Remettre ») : ce geste-ci part quand elle expire,
 * et l'écran n'a plus rien à dire de la réussite.
 */
export function withDeleteTask() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => ({
      /**
       * Retire le pas de l'état, puis l'efface par l'API ; s'il n'est pas effacé, il revient à sa place. Un pas qui
       * n'est plus dans l'état (déjà effacé, ou parti avec son étape) est ignoré : l'effacement peut être demandé
       * plusieurs fois pour le même pas. Un pas déjà effacé côté serveur (404) l'est : rien à signaler.
       */
      deleteTask(taskId: string): void {
        const { kept, removed } = removeWhere(store.tasks(), (task) => task.id === taskId);
        if (removed.length === 0) return;
        void store._write({
          action: 'eraseTask',
          targets: [taskId],
          apply: () => patchState(store, { tasks: kept }),
          commands: [{
            send: async () => {
              try {
                await objectivesApi.deleteTask(taskId);
              } catch (error) {
                if (errorCodeOf(error) !== 'TASK_NOT_FOUND') throw error;
              }
            },
            // Il revient à sa place, sauf si son étape est partie entre-temps : il part avec elle, et c'est elle qui parle.
            rollBack: () => {
              const objectiveIds = new Set(store.objectives().map((objective) => objective.id));
              const back = removed.filter(({ item }) => objectiveIds.has(item.objectiveId));
              if (back.length === 0) return false;
              patchState(store, { tasks: restoreRemoved(store.tasks(), back) });
              return true;
            },
          }],
        });
      },
    })),
  );
}
