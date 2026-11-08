import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { subtreeIds } from "../../mapper/objective-view.mapper";
import { ObjectiveState } from "../objective.store";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { removeWhere, restoreRemoved } from "../utils/removed-items";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

/**
 * Effacer un objectif ou une étape (un sous-objectif), avec tout ce qui en dépend : ses étapes et leurs pas, et,
 * pour un objectif, sa conversation avec Akari (l'API s'en charge). L'écran a déjà demandé la confirmation.
 */
export function withDeleteObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => ({
      /**
       * Retire l'objectif (ou l'étape), ses descendants et leurs pas de l'état, puis l'efface par l'API ; s'il n'est
       * pas effacé, tout revient à sa place. Un objectif qui n'est plus dans l'état est ignoré, et un objectif déjà
       * effacé côté serveur (404) l'est : rien à signaler. Tant qu'un élément de ce qu'il emporte n'est pas encore
       * enregistré, rien ne part.
       */
      deleteObjective(objectiveId: string): void {
        const target = store.objectives().find((objective) => objective.id === objectiveId);
        if (!target) return;
        const ids = subtreeIds(objectiveId, store.objectives());
        const objectives = removeWhere(store.objectives(), (objective) => ids.has(objective.id));
        const tasks = removeWhere(store.tasks(), (task) => ids.has(task.objectiveId));
        const isStage = target.parentId !== null;

        void store._write({
          action: isStage ? 'eraseStage' : 'eraseObjective',
          targets: [...ids, ...tasks.removed.map(({ item }) => item.id)],
          apply: () => patchState(store, { objectives: objectives.kept, tasks: tasks.kept }),
          commands: [{
            send: async () => {
              try {
                await objectivesApi.deleteObjective(objectiveId);
              } catch (error) {
                if (errorCodeOf(error) !== 'OBJECTIVE_NOT_FOUND') throw error;
              }
            },
            // Tout revient à sa place, sauf une étape dont l'objectif est parti entre-temps : elle part avec lui.
            rollBack: () => {
              const parentId = target.parentId;
              if (parentId !== null && !store.objectives().some((objective) => objective.id === parentId)) return false;
              patchState(store, {
                objectives: restoreRemoved(store.objectives(), objectives.removed),
                tasks: restoreRemoved(store.tasks(), tasks.removed),
              });
              return true;
            },
          }],
          success: isStage ? SUCCESS_ANNOUNCEMENTS.stageErased : SUCCESS_ANNOUNCEMENTS.objectiveErased,
        });
      },
    })),
  );
}
