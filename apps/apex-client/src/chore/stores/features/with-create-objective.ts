import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods, withState } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ObjectiveEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { replaceTemporary, temporaryId } from "../utils/map-optimistique-id";
import { RequestStatusState } from "../utils/loading-feature";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type CreateObjectiveState = {
  /**
   * L'identifiant définitif du dernier objectif créé, une fois enregistré ; null pendant l'enregistrement
   * (il est remis à null à chaque nouvelle création) et si l'enregistrement n'a pas abouti.
   * Sert à ouvrir l'objectif (/objectifs/:id/akari) après « Je m'y engage ».
   */
  lastCreatedObjectiveId: string | null;
};

export function withCreateObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState & RequestStatusState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withState<CreateObjectiveState>({ lastCreatedObjectiveId: null }),
    withMethods((store, objectivesApi = inject(ObjectivesApi)) => ({
      /** Crée un objectif, d'abord dans l'état (id temporaire) puis par l'API ; lastCreatedObjectiveId donne l'id définitif. */
      createObjective(data: { title: string; description?: string; why?: string; dueDate?: Date }): void {
        const tempId = temporaryId();
        const shown: ObjectiveViewModel = {
          id: tempId,
          title: data.title,
          description: data.description || "",
          why: data.why || "",
          dueDate: data.dueDate?.toISOString() || "",
          parentId: null,
          done: false,
        };
        void store._write({
          action: 'createObjective',
          targets: [],
          apply: () =>
            patchState(store, {
              objectives: [...store.objectives(), shown],
              requestStatus: 'pending',
              lastCreatedObjectiveId: null,
            }),
          commands: [{
            send: () =>
              objectivesApi.createObjective({
                title: data.title,
                description: data.description,
                why: data.why,
                dueDate: data.dueDate?.toISOString(),
              }),
            accept: (created: ObjectiveEntity) =>
              patchState(store, {
                objectives: replaceTemporary(store.objectives(), tempId, ObjectiveMapper.toObjectiveViewModel(created)),
                lastCreatedObjectiveId: created.id,
                requestStatus: 'fulfilled',
              }),
            rollBack: (code) =>
              patchState(store, {
                objectives: store.objectives().filter((objective) => objective.id !== tempId),
                requestStatus: { error: failureReport('createObjective', code) },
              }),
          }],
          success: SUCCESS_ANNOUNCEMENTS.objectiveCreated,
        });
      },
    })),
  );
}
