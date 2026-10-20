import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { AddSubObjectiveUsecase } from "@org/objective";
import { isTemporaryId, swapObjectiveId, withOptimistiqueId } from "../utils/map-optimistique-id";
import { tapResponse } from "@ngrx/operators";
import { RequestStatusState } from "../utils/loading-feature";
import { withOwnerId } from "../utils/filter-auth-operation";
import { WriteQueue } from "../utils/write-queue";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export function withCreateSubObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((store,
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      addSubObjectiveUsecase = inject(AddSubObjectiveUsecase),
      writes = inject(WriteQueue)
    )=>{
      /** Retire l'étape optimiste, et les pas posés dessus entre-temps. */
      const removeTemporary = (tempId: string) =>
        patchState(store, {
          objectives: store.objectives().filter((obj) => obj.id !== tempId),
          tasks: store.tasks().filter((task) => task.objectiveId !== tempId),
        });

      return {
      /** Ajoute une étape (sous-objectif direct) à un objectif, d'abord dans l'état puis en base. */
      addSubObjective: rxMethod<{ objectiveId: string; subObjectiveTitle: string }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          withOptimistiqueId(),
          tap(({ objectiveId, subObjectiveTitle, tempId }) => {
            patchState(store, { requestStatus: 'pending' });

            const newSubObjective: ObjectiveViewModel = {
              id: tempId,
              title: subObjectiveTitle,
              why: "",
              description: "",
              dueDate: "",
              parentId: objectiveId,
            };

            patchState(store, { objectives: [...store.objectives(), newSubObjective] });
          }),
          mergeMap(({ objectiveId, subObjectiveTitle, ownerId, tempId }) =>
            from(writes.run(async () => {
              // L'objectif a pu être créé entre-temps : son id définitif est connu ici
              const parentObjectiveId = writes.resolve(objectiveId);
              if (isTemporaryId(parentObjectiveId)) return null; // sa création n'a pas abouti (déjà signalé)
              return addSubObjectiveUsecase.execute({ parentObjectiveId, title: subObjectiveTitle, ownerId });
            })).pipe(
              tapResponse({
                next: (data) => {
                  if (data === null) {
                    removeTemporary(tempId);
                    patchState(store, { requestStatus: 'idle' });
                  } else if (data.success) {
                    writes.link(tempId, data.data.id);
                    patchState(store, {
                      ...swapObjectiveId({ objectives: store.objectives(), tasks: store.tasks() }, tempId, data.data.id),
                      requestStatus: 'fulfilled'
                    });

                    annonces.annoncer(SUCCESS_ANNOUNCEMENTS.stageAdded);
                  } else {
                    const report = failureReport('addStage', data.error.code);
                    annonces.signaler(report);
                    removeTemporary(tempId);
                    patchState(store, { requestStatus: { error: report } });
                  }
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('addStage');
                  annonces.signaler(report);
                  removeTemporary(tempId);
                  patchState(store, { requestStatus: { error: report } });
                },
              })
            )
          )
        )
      )
      };
    })
  )
}
