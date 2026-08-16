import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, pipe, switchMap, tap } from "rxjs";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { MessageService } from "primeng/api";
import { AddSubObjectiveUsecase } from "@org/objective";
import { withOptimistiqueId } from "../utils/map-optimistique-id";
import { tapResponse } from "@ngrx/operators";
import { RequestStatusState } from "../utils/loading-feature";
import { withOwnerId } from "../utils/filter-auth-operation";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";



export function withCreateSubObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((store,
      sessionStore = inject(SessionStore),
      messageService = inject(MessageService),
      addSubObjectiveUsecase = inject(AddSubObjectiveUsecase)
    )=>({
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
          switchMap(({ objectiveId, subObjectiveTitle, ownerId, tempId }) =>
            from(addSubObjectiveUsecase.execute({ parentObjectiveId: objectiveId, title: subObjectiveTitle, ownerId })).pipe(
              tapResponse({
                next: (data) => {
                  if (data.success) {
                    const updatedSubObjective: ObjectiveViewModel = {
                      ...data.data,
                      id: data.data.id, // Ensure the ID is updated from the backend response
                      why: "",
                      description: "",
                      dueDate: "",
                      parentId: objectiveId,
                    };

                    patchState(store, {
                      objectives: store.objectives().map((obj) =>
                        obj.id === tempId
                          ? updatedSubObjective
                          : obj
                      ),
                      requestStatus: 'fulfilled'
                    });

                    messageService.add({ severity: 'success', summary: 'Succès', detail: "Le sous-objectif a été ajouté avec succès." });
                  } else {
                    messageService.add({ severity: 'error', summary: 'Erreur', detail: data.error.message });
                    patchState(store, { objectives: store.objectives().filter((obj) => obj.id !== tempId) });
                    patchState(store, { requestStatus: {error: data.error.message} });
                  }
                },
                error: () => {
                  messageService.add({ severity: 'error', summary: 'Erreur', detail: "Impossible d'ajouter le sous-objectif. Veuillez réessayer." });
                  patchState(store, { objectives: store.objectives().filter((obj) => obj.id !== tempId) });
                  patchState(store, { requestStatus: {error: "Impossible d'ajouter le sous-objectif. Veuillez réessayer."} });
                },
              })
            )
          )
        )
      )
    }))
  )
}
