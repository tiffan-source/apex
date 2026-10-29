import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods, withState } from "@ngrx/signals";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { swapObjectiveId, withOptimistiqueId } from "../utils/map-optimistique-id";
import { RequestStatusState } from "../utils/loading-feature";
import { WriteQueue } from "../utils/write-queue";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type CreateObjectiveState = {
  /**
   * L'identifiant définitif du dernier objectif créé, une fois enregistré ; null pendant l'enregistrement
   * (il est remis à null à chaque nouvelle création) et si l'enregistrement n'a pas abouti.
   * Sert à ouvrir l'objectif (/objectifs/:id/akari) après « Je m'y engage ».
   */
  lastCreatedObjectiveId: string | null;
};

export function withCreateObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withState<CreateObjectiveState>({ lastCreatedObjectiveId: null }),
    withMethods((store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      /** Retire l'objectif optimiste et ce qui a été posé dessus entre-temps. */
      const removeTemporary = (tempId: string) =>
        patchState(store, {
          objectives: store.objectives().filter((obj) => obj.id !== tempId && obj.parentId !== tempId),
        });

      return {
      /** Crée un objectif, d'abord dans l'état (id temporaire) puis par l'API ; lastCreatedObjectiveId donne l'id définitif. */
      createObjective: rxMethod<{ title: string; description?: string; why?: string; dueDate?: Date }>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          withOptimistiqueId(),
          tap(({ title, description, why, dueDate, tempId }) => {

            patchState(store, { requestStatus: 'pending', lastCreatedObjectiveId: null });

            const newObjective: ObjectiveViewModel = {
              id: tempId,
              title,
              description: description || "",
              why: why || "",
              dueDate: dueDate?.toISOString() || "",
              parentId: null
            };
            patchState(store, { objectives: [...store.objectives(), newObjective] });
          }),
          // mergeMap + file d'écritures : deux créations rapprochées reçoivent chacune leur réponse
          mergeMap(({ title, description, why, dueDate, tempId }) =>
            from(writes.run(() => objectivesApi.create({ title, description, why, dueDate: dueDate?.toISOString() }))).pipe(
              tapResponse({
                next: (created) => {
                  const realId = created.id;
                  writes.link(tempId, realId);
                  patchState(store, {
                    ...swapObjectiveId({ objectives: store.objectives(), tasks: store.tasks() }, tempId, realId),
                    lastCreatedObjectiveId: realId,
                    requestStatus: 'fulfilled'
                  });

                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveCreated);
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('createObjective', errorCodeOf(error));
                  annonces.signaler(report);
                  removeTemporary(tempId);
                  patchState(store, { requestStatus: { error: report } });
                },
              })
            )
          )
        )
      ),
      };
    })
  );
}
