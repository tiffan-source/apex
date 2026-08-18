import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { inject } from "@angular/core";
import { EditObjectiveUsecase } from "@org/objective";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, map, pipe, switchMap, tap } from "rxjs";
import { withOwnerId } from "../utils/filter-auth-operation";
import { SessionStore } from "../session.store";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { MessageService } from "primeng/api";

export function withEditObjective() {
  return signalStoreFeature(
    {state: type<ObjectiveState & RequestStatusState>()},
    withMethods((store,
      editObjective = inject(EditObjectiveUsecase),
      sessionStore = inject(SessionStore),
      messageService = inject(MessageService)
    )=>({
      editObjective: rxMethod<{id: string, title: string; description?: string; why?: string; dueDate?: Date }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          map((data)=>({...data, oldObj: store.objectives().find(obj=>obj.id === data.id) as ObjectiveViewModel})),
          tap(({title, description, dueDate, why, id, oldObj})=>{
            patchState(store, {requestStatus: 'pending'});

            const updateObjective: ObjectiveViewModel = {
              id,
              title,
              description: description || "",
              why: why || "",
              dueDate: dueDate?.toISOString() || "",
              parentId: oldObj.parentId
            };

            patchState(store, {objectives: [...store.objectives().map((obj)=>{
              if (obj.id !== id)
                return obj;
              else {
                return updateObjective
              }
            })]})
          }),
          switchMap(({title, id, ownerId, description, dueDate, why, oldObj})=>
            from(editObjective.execute({
              objective: {
                id,
                title,
                description,
                dueDate,
                why
              },
              ownerId
            })).pipe(
              tapResponse({
                next: (data) =>{
                  if (data.success) {
                    messageService.add({severity: 'success', summary: "Succes", detail: "L'objectif a bien été modifiée"})
                  } else {
                    messageService.add({severity: 'error', summary: 'Erreur', detail: data.error.message})
                    patchState(store, {objectives: [...store.objectives().map((obj)=>{
                      if (obj.id !== id)
                        return obj;
                      else {
                        return oldObj
                      }
                    })]})
                  }
                  patchState(store, {requestStatus: data.success ? 'fulfilled' : {error: data.error.message}})
                },
                error: (error)=>{
                  messageService.add({ severity: 'error', summary: 'Erreur', detail: "Impossible de modifier l'objectif" })
                  patchState(store, {requestStatus: {error: "Impossible de modifier l'objectif"}})
                  patchState(store, {objectives: [...store.objectives().map((obj)=>{
                    if (obj.id !== id)
                      return obj;
                    else {
                      return oldObj
                    }
                  })]})
                }
              })
            )
          )
        )
      )
    }))
  )
}
