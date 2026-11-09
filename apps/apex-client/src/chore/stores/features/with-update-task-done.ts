import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { TaskEntity } from "../../api/api.models";
import { ObjectiveState } from "../objective.store";
import { replaceFieldsIfShown } from "../utils/command-fields";
import { forgetTask } from "../utils/forget";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

export function withUpdateTaskDone() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => {
      /** Le pas montre `next` à la place de `shown`, sauf si un geste plus récent l'a déjà changé. */
      const replaceDone = (taskId: string, shown: boolean, next: boolean) =>
        patchState(store, { tasks: replaceFieldsIfShown(store.tasks(), taskId, { done: shown }, { done: next }) });

      return {
        /**
         * Coche (completeTask) ou décoche (reopenTask) un pas, d'abord dans l'état puis par l'API, qui rend le pas ;
         * retour en arrière si elle refuse ; un pas qu'elle ne connaît plus quitte l'écran. Le « fait » de l'étape et
         * de l'objectif n'est pas relu : c'est l'API qui le dit, à la prochaine lecture.
         */
        updateTaskDone({ taskId, done }: { taskId: string; done: boolean }): void {
          void store._write({
            action: 'toggleTask',
            targets: [taskId],
            apply: () => replaceDone(taskId, !done, done),
            commands: [{
              send: () => (done ? objectivesApi.completeTask(taskId) : objectivesApi.reopenTask(taskId)),
              accept: (saved: TaskEntity) => replaceDone(taskId, done, saved.done),
              rollBack: () => replaceDone(taskId, done, !done),
              forget: (code) => {
                if (code !== 'TASK_NOT_FOUND') return false;
                patchState(store, { tasks: forgetTask(store.tasks(), taskId) });
                return true;
              },
            }],
            success: done ? SUCCESS_ANNOUNCEMENTS.taskDone : SUCCESS_ANNOUNCEMENTS.taskUndone,
          });
        },
      };
    }),
  );
}
