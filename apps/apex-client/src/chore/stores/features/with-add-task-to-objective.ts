import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { AddTaskToObjectiveUsecase } from "@org/objective";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { MessageService } from "primeng/api";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, pipe, switchMap, tap } from "rxjs";
import { withOwnerId } from "../utils/filter-auth-operation";
import { withOptimistiqueId } from "../utils/map-optimistique-id";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";

export type TaskQuery = {
  title: string;
  importance: number;
  urgency: number;
}

export function withAddTaskToObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withMethods((store,
      addTaskToObjectiveUsecase = inject(AddTaskToObjectiveUsecase),
      sessionStore = inject(SessionStore),
      messageService = inject(MessageService)
    )=>({
      addTaskToObjective: rxMethod<{ objectiveId: string; task: TaskQuery }>(
        pipe(
          withOwnerId(sessionStore.currentUserId),
          withOptimistiqueId(),
          tap(({ objectiveId, task, tempId }) => {
            patchState(store, { requestStatus: 'pending' });

            const newTask: TaskViewModel = {
              id: tempId,
              title: task.title,
              importance: task.importance,
              urgency: task.urgency,
              done: false,
              objectiveId: objectiveId,
            };

            patchState(store, {
              tasks: [...store.tasks(), newTask],
            });
          }),
          switchMap(({ objectiveId, task, ownerId, tempId }) =>
            from(addTaskToObjectiveUsecase.execute(objectiveId, { ...task, ownerId })).pipe(
              tapResponse({
                next: (data) => {
                  if (data.success) {
                    const updatedTask: TaskViewModel = {
                      id: data.data.id,
                      title: data.data.title,
                      importance: data.data.importance,
                      urgency: data.data.urgency,
                      done: false,
                      objectiveId,
                    };

                    patchState(store, {
                      tasks: store.tasks().map((t) => t.id === tempId ? updatedTask : t),
                      requestStatus: 'fulfilled'
                    });

                    messageService.add({ severity: 'success', summary: 'Succès', detail: "La tâche a été ajoutée avec succès." });
                  } else {
                    messageService.add({ severity: 'error', summary: 'Erreur', detail: data.error.message });
                    patchState(store, {
                      tasks: store.tasks().filter((t) => t.id !== tempId),
                      requestStatus: {error: data.error.message}
                    });
                  }
                },
                error: (error) => {
                  console.error(error);
                  messageService.add({ severity: 'error', summary: 'Erreur', detail: "Impossible d'ajouter la tâche. Veuillez réessayer." });
                  patchState(store, {
                    tasks: store.tasks().filter((t) => t.id !== tempId),
                    requestStatus: {error: "Impossible d'ajouter la tâche. Veuillez réessayer."}
                  });
                },
              })
            )
          )
        )
      )
    }))
  )
}
