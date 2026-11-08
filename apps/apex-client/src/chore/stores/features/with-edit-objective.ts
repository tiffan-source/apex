import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ClarifyObjectiveBody, ObjectiveEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { pickFields, replaceFieldsIfShown } from "../utils/command-fields";
import { forgetObjective } from "../utils/forget";
import type { Gesture, WriteCommand, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

export type EditObjectiveInput = {
  id: string;
  title: string;
  /** Absente, la description reste telle quelle ; `""` la vide. */
  description?: string;
  /** Absent, le pourquoi reste tel quel ; `""` le vide. */
  why?: string;
  /** Absente, l'échéance reste telle quelle. */
  dueDate?: Date;
};

export function withEditObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => {
      const replace = (id: string, shown: Partial<ObjectiveViewModel>, next: Partial<ObjectiveViewModel>) =>
        patchState(store, { objectives: replaceFieldsIfShown(store.objectives(), id, shown, next) });

      /**
       * Une commande du geste, pour ces champs : acceptée, ils prennent ce que l'API rend ; refusée, ils reviennent
       * seuls en arrière ; l'objectif inconnu de l'API quitte l'écran.
       */
      const command = (
        old: ObjectiveViewModel,
        shown: ObjectiveViewModel,
        fields: readonly (keyof ObjectiveViewModel)[],
        send: (id: string) => Promise<ObjectiveEntity>,
      ): WriteCommand<ObjectiveEntity> => ({
        send: () => send(old.id),
        accept: (saved) =>
          replace(old.id, pickFields(shown, fields), pickFields(ObjectiveMapper.toObjectiveViewModel(saved), fields)),
        rollBack: () => replace(old.id, pickFields(shown, fields), pickFields(old, fields)),
        forget: (code) => {
          if (code !== 'OBJECTIVE_NOT_FOUND') return false;
          patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, old.id));
          return true;
        },
      });

      /** Les commandes du geste : seulement ce qui a changé, dans l'ordre renommer, préciser, donner une échéance. */
      const commandsFor = (old: ObjectiveViewModel, shown: ObjectiveViewModel): WriteCommand<ObjectiveEntity>[] => {
        const commands: WriteCommand<ObjectiveEntity>[] = [];
        if (shown.title !== old.title) {
          commands.push(command(old, shown, ['title'], (id) => objectivesApi.renameObjective(id, shown.title)));
        }
        const clarify: ClarifyObjectiveBody = {};
        if (shown.description !== old.description) clarify.description = shown.description;
        if (shown.why !== old.why) clarify.why = shown.why;
        const clarified = Object.keys(clarify) as (keyof ClarifyObjectiveBody)[];
        if (clarified.length > 0) {
          commands.push(command(old, shown, clarified, (id) => objectivesApi.clarifyObjective(id, clarify)));
        }
        if (shown.dueDate !== old.dueDate && shown.dueDate) {
          commands.push(command(old, shown, ['dueDate'], (id) => objectivesApi.setObjectiveDeadline(id, shown.dueDate)));
        }
        return commands;
      };

      return {
        /**
         * Modifie un objectif ou une étape, d'abord dans l'état puis par l'API, une commande par intention
         * (renameObjective, clarifyObjective, setObjectiveDeadline), seulement pour ce qui a changé. Chacune est
         * acceptée ou revient en arrière seule ; l'arbre n'est relu que si l'issue de l'une d'elles est inconnue.
         */
        editObjective({ id, title, description, why, dueDate }: EditObjectiveInput): void {
          // Rien à modifier si l'objectif n'est pas (ou plus) chargé
          const old = store.objectives().find((objective) => objective.id === id);
          if (!old) return;
          // Un champ absent reste tel qu'il est affiché, comme l'API le laisse en base.
          const shown: ObjectiveViewModel = {
            ...old,
            title,
            description: description ?? old.description,
            why: why ?? old.why,
            dueDate: dueDate?.toISOString() ?? old.dueDate,
          };
          const commands = commandsFor(old, shown);
          if (commands.length === 0) return;
          const fields = (Object.keys(shown) as (keyof ObjectiveViewModel)[]).filter((field) => shown[field] !== old[field]);
          void store._write({
            action: 'editObjective',
            targets: [id],
            apply: () => replace(id, pickFields(old, fields), pickFields(shown, fields)),
            commands,
            success: SUCCESS_ANNOUNCEMENTS.objectiveSaved,
          });
        },
      };
    }),
  );
}
