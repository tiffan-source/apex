import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { TaskEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { TaskViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { pickFields, replaceFieldsIfShown } from "../utils/command-fields";
import { forgetObjective, forgetTask } from "../utils/forget";
import type { Gesture, WriteCommand, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

export type EditTaskInput = {
  title: string;
  importance: number;
  urgency: number;
  /** L'objectif ou l'étape qui porte le pas (le changer déplace le pas). */
  objectiveId: string;
};

export function withTaskEdit() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => {
      const replace = (taskId: string, shown: Partial<TaskViewModel>, next: Partial<TaskViewModel>) =>
        patchState(store, { tasks: replaceFieldsIfShown(store.tasks(), taskId, shown, next) });

      /**
       * Une commande du geste, pour ces champs : acceptée, ils prennent ce que l'API rend ; refusée, ils reviennent
       * seuls en arrière, le reste du geste garde sa chance. Un pas inconnu de l'API quitte l'écran ; une étape
       * de destination inconnue aussi, et le pas revient où il était.
       */
      const command = (
        old: TaskViewModel,
        shown: TaskViewModel,
        fields: readonly (keyof TaskViewModel)[],
        send: () => Promise<TaskEntity>,
      ): WriteCommand<TaskEntity> => ({
        send,
        accept: (saved) => replace(old.id, pickFields(shown, fields), pickFields(ObjectiveMapper.toTaskViewModel(saved), fields)),
        rollBack: () => replace(old.id, pickFields(shown, fields), pickFields(old, fields)),
        forget: (code) => {
          if (code === 'TASK_NOT_FOUND') {
            patchState(store, { tasks: forgetTask(store.tasks(), old.id) });
            return true;
          }
          if (code === 'OBJECTIVE_NOT_FOUND' && fields.includes('objectiveId')) {
            replace(old.id, pickFields(shown, fields), pickFields(old, fields));
            patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, shown.objectiveId));
            return true;
          }
          return false;
        },
      });

      /** Les commandes du geste : seulement ce qui a changé, dans l'ordre renommer, reprioriser, déplacer. */
      const commandsFor = (old: TaskViewModel, shown: TaskViewModel): WriteCommand<TaskEntity>[] => {
        const commands: WriteCommand<TaskEntity>[] = [];
        if (shown.title !== old.title) {
          commands.push(command(old, shown, ['title'], () => objectivesApi.renameTask(old.id, shown.title)));
        }
        if (shown.importance !== old.importance || shown.urgency !== old.urgency) {
          commands.push(
            command(old, shown, ['importance', 'urgency'], () =>
              objectivesApi.reprioritizeTask(old.id, shown.importance, shown.urgency),
            ),
          );
        }
        if (shown.objectiveId !== old.objectiveId) {
          commands.push(command(old, shown, ['objectiveId'], () => objectivesApi.moveTask(old.id, shown.objectiveId)));
        }
        return commands;
      };

      return {
        /**
         * Modifie un pas, d'abord dans l'état puis par l'API, une commande par intention (renameTask,
         * reprioritizeTask, moveTask), seulement pour ce qui a changé. Chacune est acceptée ou revient en
         * arrière seule ; l'arbre n'est relu que si l'issue de l'une d'elles est inconnue.
         */
        editTask({ taskId, input }: { taskId: string; input: EditTaskInput }): void {
          // Rien à modifier si le pas n'est pas (ou plus) chargé
          const old = store.tasks().find((task) => task.id === taskId);
          if (!old) return;
          const shown: TaskViewModel = { ...old, ...input };
          const commands = commandsFor(old, shown);
          if (commands.length === 0) return;
          const fields = (Object.keys(input) as (keyof EditTaskInput)[]).filter((field) => shown[field] !== old[field]);
          void store._write({
            action: 'editTask',
            // Le pas, et l'étape où il va : tous deux enregistrés.
            targets: [taskId, input.objectiveId],
            apply: () => replace(taskId, pickFields(old, fields), pickFields(shown, fields)),
            commands,
            success: SUCCESS_ANNOUNCEMENTS.taskSaved,
          });
        },
      };
    }),
  );
}
