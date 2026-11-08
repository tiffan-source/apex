import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ObjectiveEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { forgetObjective } from "../utils/forget";
import { replaceTemporary, temporaryId } from "../utils/map-optimistique-id";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { WriteQueue } from "../utils/write-queue";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

export function withCreateSubObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withMethods((store, objectivesApi = inject(ObjectivesApi), writes = inject(WriteQueue)) => ({
      /** Ajoute une étape (sous-objectif direct) à un objectif enregistré, d'abord dans l'état puis par l'API. */
      addSubObjective({ objectiveId, subObjectiveTitle }: { objectiveId: string; subObjectiveTitle: string }): void {
        const tempId = temporaryId();
        const shown: ObjectiveViewModel = {
          id: tempId,
          title: subObjectiveTitle,
          why: "",
          description: "",
          dueDate: "",
          parentId: objectiveId,
          done: false,
        };
        const removeTemporary = () =>
          patchState(store, { objectives: store.objectives().filter((objective) => objective.id !== tempId) });

        void store._write({
          action: 'addStage',
          targets: [objectiveId],
          apply: () => patchState(store, { objectives: [...store.objectives(), shown] }),
          commands: [{
            send: () => objectivesApi.addSubObjective(objectiveId, { title: subObjectiveTitle }),
            accept: (created: ObjectiveEntity) => {
              // L'écran garde ouverte une étape choisie pendant son enregistrement (objective-page).
              writes.link(tempId, created.id);
              patchState(store, {
                objectives: replaceTemporary(store.objectives(), tempId, ObjectiveMapper.toObjectiveViewModel(created)),
              });
            },
            rollBack: removeTemporary,
            // L'objectif qui devait la porter n'existe plus : il quitte l'écran, avec elle.
            forget: (code) => {
              if (code !== 'OBJECTIVE_NOT_FOUND') return false;
              patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, objectiveId));
              return true;
            },
          }],
          success: SUCCESS_ANNOUNCEMENTS.stageAdded,
        });
      },
    })),
  );
}
