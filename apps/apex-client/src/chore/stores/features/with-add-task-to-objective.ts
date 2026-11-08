import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { TaskEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { forgetObjective } from "../utils/forget";
import { replaceTemporary, temporaryId } from "../utils/map-optimistique-id";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

export type TaskQuery = {
  title: string;
  importance: number;
  urgency: number;
}

export function withAddTaskToObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome>; _saved: (temporaryId: string, realId: string) => void }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => ({
      /** Ajoute un pas à un objectif ou à une étape enregistrés (objectiveId), d'abord dans l'état puis par l'API. */
      addTaskToObjective({ objectiveId, task }: { objectiveId: string; task: TaskQuery }): void {
        const tempId = temporaryId();
        const shown: TaskViewModel = {
          id: tempId,
          title: task.title,
          importance: task.importance,
          urgency: task.urgency,
          done: false,
          objectiveId,
        };
        const removeTemporary = () => patchState(store, { tasks: store.tasks().filter((item) => item.id !== tempId) });

        void store._write({
          action: 'addTask',
          targets: [objectiveId],
          apply: () => patchState(store, { tasks: [...store.tasks(), shown] }),
          commands: [{
            send: () =>
              objectivesApi.addTaskToObjective(objectiveId, { title: task.title, importance: task.importance, urgency: task.urgency }),
            accept: (created: TaskEntity) => {
              store._saved(tempId, created.id);
              patchState(store, { tasks: replaceTemporary(store.tasks(), tempId, ObjectiveMapper.toTaskViewModel(created)) });
            },
            rollBack: removeTemporary,
            // L'objectif ou l'étape n'existe plus : il quitte l'écran, avec le pas.
            forget: (code) => {
              if (code !== 'OBJECTIVE_NOT_FOUND') return false;
              patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, objectiveId));
              return true;
            },
          }],
          success: SUCCESS_ANNOUNCEMENTS.taskAdded,
        });
      },
    })),
  );
}
