import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, map, pipe, switchMap, tap } from "rxjs";
import { RequestStatusState } from "../utils/loading-feature";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { EditMyTaskUsecase } from "@org/objective";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { withOwnerId } from "../utils/filter-auth-operation";
import { tapResponse } from "@ngrx/operators";
import { MessageService } from "primeng/api";

export type EditTaskInput = {
  title: string;
  importance: number;
  urgency: number;
  objectiveId: string;
};

export function withTaskEdit() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((
      store,
      editMyTaskUsecase = inject(EditMyTaskUsecase),
      sessionStore = inject(SessionStore),
      messageService = inject(MessageService)
    ) => ({
      editTask: rxMethod<{ taskId: string; input: EditTaskInput }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          map(data => ({...data, oldTask: store.tasks().find(task => task.id === data.taskId)})),
          tap(({ taskId, input, oldTask }) => {
            patchState(store, { requestStatus: 'pending' });

            const updatedTask: TaskViewModel = {
              id: taskId,
              title: input.title,
              importance: input.importance,
              urgency: input.urgency,
              done: oldTask?.done || false,
              objectiveId: input.objectiveId
            };

            patchState(store, {
              tasks: [...store.tasks().map((task) => {
                if (task.id !== taskId)
                  return task;
                else {
                  return updatedTask;
                }
              })]
            });
          }),
          switchMap(({input, oldTask, taskId, ownerId})=>
            from(editMyTaskUsecase.execute({
              ownerId,
              task: {
                id: taskId,
                title: input.title,
                importance: input.importance,
                urgency: input.urgency,
                objectiveId: input.objectiveId
              }
            })).pipe(
              tapResponse({
                next: (data) => {
                  if(data.success) {
                    patchState(store, { requestStatus: 'fulfilled' });
                    messageService.add({ severity: 'success', summary: 'Succès', detail: "La tâche a été modifiée avec succès." });
                  }else{
                    patchState(store, { requestStatus: { error: data.error.message } });
                    messageService.add({ severity: 'error', summary: 'Erreur', detail: data.error.message });
                    patchState(store, {
                      tasks: [...store.tasks().map((task) => {
                        if (task.id !== taskId)
                          return task;
                        else {
                          return oldTask as TaskViewModel;
                        }
                      })]
                    });
                  }
                },
                error: (error) => {
                  messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to edit task' });
                  patchState(store, { requestStatus: { error: "Failed to edit task" } });
                  patchState(store, {
                    tasks: [...store.tasks().map((task) => {
                      if (task.id !== taskId)
                        return task;
                      else {
                        return oldTask as TaskViewModel;
                      }
                    })]
                  });
                }
              })
            )
          )
        )
      )
    }))
  );
}
