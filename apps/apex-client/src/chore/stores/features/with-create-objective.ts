import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods, withState } from "@ngrx/signals";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { CreateObjectiveUsecase } from "@org/objective";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { withOwnerId } from "../utils/filter-auth-operation";
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
      createObjectiveUsecase = inject(CreateObjectiveUsecase),
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
      /** Crée un objectif, d'abord dans l'état (id temporaire) puis en base ; lastCreatedObjectiveId donne l'id définitif. */
      createObjective: rxMethod<{ title: string; description?: string; why?: string; dueDate?: Date }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
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
          mergeMap(({ title, description, why, dueDate, ownerId, tempId }) =>
            from(writes.run(() => createObjectiveUsecase.execute({ title, description, why, dueDate, ownerId }))).pipe(
              tapResponse({
                next: (data) => {
                  if (data.success) {
                    const realId = data.data.id;
                    writes.link(tempId, realId);
                    patchState(store, {
                      ...swapObjectiveId({ objectives: store.objectives(), tasks: store.tasks() }, tempId, realId),
                      lastCreatedObjectiveId: realId,
                      requestStatus: 'fulfilled'
                    });

                    annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveCreated);
                  } else {
                    const report = failureReport('createObjective', data.error.code);
                    annonces.signaler(report);
                    removeTemporary(tempId);
                    patchState(store, { requestStatus: { error: report } });
                  }
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('createObjective');
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
