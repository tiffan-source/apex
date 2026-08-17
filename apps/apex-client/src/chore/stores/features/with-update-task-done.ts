import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { pipe, tap, from, mergeMap } from "rxjs";
import { inject } from "@angular/core";
import { UpdateDoneStatusOfTaskUsecase } from "@org/objective";
import { tapResponse } from "@ngrx/operators";
import { MessageService } from "primeng/api";

export function withUpdateTaskDone() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withMethods((
      store,
      updateDoneStatusOfTaskUsecase = inject(UpdateDoneStatusOfTaskUsecase),
      messageService = inject(MessageService)
    )=>({
      udpateTaskDone: rxMethod<{ taskId: string; done: boolean }>(
        pipe(
          tap(({ taskId, done }) => {
            // optimistically update the task done status in the state
            patchState(store, (state) => {
              return {
                ...state,
                tasks: state.tasks.map((task) => {
                  if (task.id === taskId) {
                    return { ...task, done };
                  }
                  return task;
                })
              }
            });
          }),
          mergeMap(({ taskId, done }) =>
            from(updateDoneStatusOfTaskUsecase.execute({ taskId, done })).pipe(
              tapResponse({
                next: (result)=> {
                  if (!result.success) {
                    messageService.add({ severity: 'error', summary: 'Erreur', detail: "Échec de la mise à jour du statut de la tâche." });
                    // revert the optimistic update in case of error
                    patchState(store, (state) => {
                      return {
                        ...state,
                        tasks: state.tasks.map((task) => {
                          if (task.id === taskId) {
                            return { ...task, done: !done }; // revert to previous state
                          }
                          return task;
                        })
                      }
                    })
                  } else {
                    messageService.add({ severity: 'success', summary: 'Succès', detail: "Le statut de la tâche a été mis à jour avec succès." });
                  }
                },
                error: (error) => {
                  messageService.add({ severity: 'error', summary: 'Erreur', detail: "Échec de la mise à jour du statut de la tâche." });
                  // revert the optimistic update in case of error
                  patchState(store, (state) => {
                    return {
                      ...state,
                      tasks: state.tasks.map((task) => {
                        if (task.id === taskId) {
                          return { ...task, done: !done }; // revert to previous state
                        }
                        return task;
                      })
                    }
                  })
                  console.error('Failed to update task done status:', error);
                }
              })
            )
          )
        )
      )
    }))
  );
}
