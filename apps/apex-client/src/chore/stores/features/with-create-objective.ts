import { inject } from "@angular/core";
import { Router } from "@angular/router";
import { patchState, signalStoreFeature, type, withMethods, withState } from "@ngrx/signals";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ObjectiveEntity } from "../../api/api.models";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { ObjectiveState } from "../objective.store";
import { replaceTemporary, temporaryId } from "../utils/map-optimistique-id";
import type { Gesture, WriteOutcome } from "../utils/optimistic-writes";
import { SUCCESS_ANNOUNCEMENTS } from "../../constants/messages.constante";

/** L'écran de « Je m'y engage » : la création y ouvre Akari sur l'objectif, si la personne y est encore. */
export const NEW_OBJECTIVE_PATH = '/objectifs/nouveau';

export type CreateObjectiveState = {
  /** Vrai pendant l'enregistrement d'un objectif créé : « Je m'y engage » ne répond plus. */
  creatingObjective: boolean;
};

export function withCreateObjective() {
  return signalStoreFeature(
    {
      state: type<ObjectiveState>(),
      methods: type<{ _write: (gesture: Gesture) => Promise<WriteOutcome> }>(),
    },
    withState<CreateObjectiveState>({ creatingObjective: false }),
    withMethods((store, objectivesApi = inject(ObjectivesApi), router = inject(Router)) => ({
      /**
       * Crée un objectif, d'abord dans l'état (id temporaire) puis par l'API. Enregistré, il s'ouvre sur Akari
       * (/objectifs/<id>/akari) si la personne attend encore sur l'écran de « Je m'y engage » ; partie ailleurs, elle
       * le retrouve dans ses objectifs. S'il n'est pas enregistré, la note le dit et le brouillon reste tel quel.
       */
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
          apply: () => patchState(store, { objectives: [...store.objectives(), shown], creatingObjective: true }),
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
              }),
            rollBack: () => patchState(store, { objectives: store.objectives().filter((objective) => objective.id !== tempId) }),
          }],
          success: SUCCESS_ANNOUNCEMENTS.objectiveCreated,
        }).then((outcome) => {
          if (outcome.status === 'skipped') return;
          patchState(store, { creatingObjective: false });
          if (outcome.status !== 'accepted') return;
          const createdId = (outcome.saved[0] as ObjectiveEntity).id;
          if (router.url.split(/[?#]/)[0] === NEW_OBJECTIVE_PATH) {
            void router.navigate(['/objectifs', createdId, 'akari']);
          }
        });
      },
    })),
  );
}
