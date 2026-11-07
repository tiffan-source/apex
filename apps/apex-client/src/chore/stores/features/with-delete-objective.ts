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
import { subtreeIds } from "../../mapper/objective-view.mapper";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

/**
 * Effacer un objectif ou une étape (un sous-objectif), avec tout ce qui en dépend : ses étapes et leurs pas, et,
 * pour un objectif, sa conversation avec Akari (l'API s'en charge). L'écran a déjà demandé la confirmation.
 */
export function withDeleteObjective() {
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
       * Retire l'objectif (ou l'étape), ses descendants et leurs pas de l'état, puis l'efface par l'API ; s'il n'est
       * pas effacé, tout revient à sa place. Un objectif qui n'est plus dans l'état est ignoré, et un objectif déjà
       * effacé côté serveur (404) l'est : rien à signaler.
       */
      deleteObjective: rxMethod<string>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          map((objectiveId) => {
            const target = store.objectives().find((objective) => objective.id === objectiveId);
            const ids = subtreeIds(objectiveId, store.objectives());
            return {
              objectiveId,
              target,
              objectives: removeWhere(store.objectives(), (objective) => ids.has(objective.id)),
              tasks: removeWhere(store.tasks(), (task) => ids.has(task.objectiveId)),
            };
          }),
          filter((data): data is typeof data & { target: NonNullable<typeof data.target> } => data.target !== undefined),
          tap(({ objectives, tasks }) => patchState(store, { objectives: objectives.kept, tasks: tasks.kept })),
          mergeMap(({ objectiveId, target, objectives, tasks }) => {
            const isStage = target.parentId !== null;
            return from(writes.run(async () => {
              const id = writes.resolve(objectiveId);
              if (isTemporaryId(id)) return null; // sa création n'a pas abouti (déjà signalé) : rien en base
              try {
                await objectivesApi.deleteObjective(id);
              } catch (error) {
                if (errorCodeOf(error) !== 'OBJECTIVE_NOT_FOUND') throw error;
              }
              return id;
            })).pipe(
              tapResponse({
                next: (deleted) => {
                  if (deleted === null) return;
                  annonces.annoncer(isStage ? SUCCESS_ANNOUNCEMENTS.stageErased : SUCCESS_ANNOUNCEMENTS.objectiveErased);
                  // Sans cette étape, son objectif peut être fait : c'est l'API qui le dit.
                  if (isStage) store.loadObjectives();
                },
                error: (error) => {
                  console.error(isStage ? 'Étape non effacée :' : 'Objectif non effacé :', error);
                  annonces.signaler(failureReport(isStage ? 'eraseStage' : 'eraseObjective', errorCodeOf(error)));
                  // Tout revient à sa place, sauf une étape dont l'objectif est parti entre-temps.
                  const parentId = target.parentId === null ? null : writes.resolve(target.parentId);
                  if (parentId !== null && !store.objectives().some((objective) => objective.id === parentId)) return;
                  patchState(store, {
                    objectives: restoreRemoved(store.objectives(), objectives.removed, (objective) => ({
                      ...objective,
                      id: writes.resolve(objective.id),
                      parentId: objective.parentId === null ? null : writes.resolve(objective.parentId),
                    })),
                    tasks: restoreRemoved(store.tasks(), tasks.removed, (task) => ({
                      ...task,
                      id: writes.resolve(task.id),
                      objectiveId: writes.resolve(task.objectiveId),
                    })),
                  });
                },
              })
            );
          })
        )
      ),
    }))
  );
}
