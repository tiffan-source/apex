import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { tapResponse } from "@ngrx/operators";
import { filter, from, map, mergeMap, pipe, tap } from "rxjs";
import type { Quadrant } from "@empreinte-studio/angular/matrice";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { ObjectiveState } from "../objective.store";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { levelsForQuadrant } from "../../mapper/matrix.mapper";
import { failureReport, taskMovedAnnouncement } from "../../constants/messages.constante";

type Levels = { importance: number; urgency: number };

/**
 * Déplacer un pas vers un quadrant de la matrice : seules l'importance et l'urgence qui doivent changer
 * changent (levelsForQuadrant). Mise à jour optimiste, persistance par la modification du pas
 * (PATCH /v1/tasks/{id}, dans la file d'écritures), retour en arrière si l'enregistrement n'aboutit pas.
 * Ne touche pas à requestStatus (action de fond).
 */
export function withMoveTaskToQuadrant() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      const setLevels = (taskId: string, levels: Levels) =>
        patchState(store, {
          tasks: store.tasks().map((task) => task.id === taskId ? { ...task, ...levels } : task)
        });

      /** Retour aux niveaux d'avant, sauf si un geste plus récent a déjà changé le pas. */
      const restore = (taskId: string, moved: Levels, previous: Levels) => {
        const id = writes.resolve(taskId);
        const current = store.tasks().find((task) => task.id === id);
        if (current && current.importance === moved.importance && current.urgency === moved.urgency) setLevels(id, previous);
      };

      const move = rxMethod<{ taskId: string; quadrant: Quadrant }>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          map(({ taskId, quadrant }) => {
            const oldTask = store.tasks().find((task) => task.id === taskId);
            return { quadrant, oldTask, levels: oldTask ? levelsForQuadrant(oldTask, quadrant) : null };
          }),
          // Un pas inconnu, ou déjà dans ce quadrant : rien à faire
          filter((data): data is { quadrant: Quadrant; oldTask: TaskViewModel; levels: Levels } =>
            data.oldTask !== undefined && data.levels !== null &&
            (data.levels.importance !== data.oldTask.importance || data.levels.urgency !== data.oldTask.urgency)
          ),
          tap(({ oldTask, levels }) => setLevels(oldTask.id, levels)),
          mergeMap(({ oldTask, levels, quadrant }) => {
            const previous: Levels = { importance: oldTask.importance, urgency: oldTask.urgency };
            return from(writes.run(async () => {
              const id = writes.resolve(oldTask.id);
              // Le titre et l'objectif tels qu'ils sont au départ de l'écriture (un geste a pu les changer avant)
              const current = store.tasks().find((task) => task.id === id) ?? oldTask;
              const objectiveId = writes.resolve(current.objectiveId);
              if (isTemporaryId(id) || isTemporaryId(objectiveId)) return null; // son ajout n'a pas abouti (déjà signalé)
              return objectivesApi.editTask(id, {
                title: current.title,
                objectiveId,
                importance: levels.importance,
                urgency: levels.urgency,
              });
            })).pipe(
              tapResponse({
                next: (saved) => {
                  if (saved === null) return;
                  annonces.annoncer(taskMovedAnnouncement(quadrant));
                },
                error: (error) => {
                  console.error(error);
                  restore(oldTask.id, levels, previous);
                  annonces.signaler(failureReport('moveTask', errorCodeOf(error)));
                }
              })
            );
          })
        )
      );

      return {
        /** Déplace un pas vers un quadrant : `store.moveTaskToQuadrant(evenement.element.id, evenement.vers)`. */
        moveTaskToQuadrant(taskId: string, quadrant: Quadrant): void {
          move({ taskId, quadrant });
        },
      };
    })
  );
}
