import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { SessionStore } from "../session.store";
import { CreateObjectiveUsecase } from "@org/objective";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { debounceTime, from, map, pipe, switchMap, tap } from "rxjs";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { MessageService } from "primeng/api";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { withOwnerId } from "../utils/filter-auth-operation";
import { withOptimistiqueId } from "../utils/map-optimistique-id";
import { RequestStatusState } from "../utils/loading-feature";

export function withCreateObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((store,
      createObjectiveUsecase = inject(CreateObjectiveUsecase),
      sessionStore = inject(SessionStore),
      messageService = inject(MessageService)
    ) => ({
      createObjective: rxMethod<{ title: string; description?: string; why?: string; dueDate?: Date }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          withOptimistiqueId(),
          tap(({ title, description, why, dueDate, tempId }) => {

            patchState(store, { requestStatus: 'pending' });

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
          switchMap(({ title, description, why, dueDate, ownerId, tempId }) =>
            from(createObjectiveUsecase.execute({ title, description, why, dueDate, ownerId })).pipe(
              tapResponse({
                next: (data) => {
                  if (data.success) {
                    const mapped = ObjectiveMapper.fromCreateObjectiveOutputToObjectiveViewModel(data.data);
                    patchState(store, {
                      objectives: store.objectives().map((obj) =>
                        obj.id === tempId
                          ? mapped
                          : obj
                      ),
                      requestStatus: 'fulfilled'
                    });

                    messageService.add({ severity: 'success', summary: 'Succès', detail: "L'objectif a été créé avec succès." });
                  } else {
                    messageService.add({ severity: 'error', summary: 'Erreur', detail: data.error.message });
                    patchState(store, { objectives: store.objectives().filter((obj) => obj.id !== tempId) });
                    patchState(store, { requestStatus: { error: data.error.message } });
                  }
                },
                error: () => {
                  messageService.add({ severity: 'error', summary: 'Erreur', detail: "Impossible de créer l'objectif. Veuillez réessayer." });
                  patchState(store, { objectives: store.objectives().filter((obj) => obj.id !== tempId) });
                  patchState(store, { requestStatus: { error: "Impossible de créer l'objectif. Veuillez réessayer." } });
                },
              })
            )
          )
        )
      ),
    })
  ));
}

