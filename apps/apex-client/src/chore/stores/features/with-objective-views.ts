import { computed } from "@angular/core";
import { signalStoreFeature, type, withComputed, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import {
  rootObjectiveOptions,
  stageOptions,
  toObjectiveCards,
  toObjectiveDetail,
} from "../../mapper/objective-view.mapper";

/**
 * Les vues des écrans Empreinte, dérivées de l'état (cahier de migration, § 4) : cartes d'objectifs, vue
 * détaillée pour l'arête, options des champs. Fait ou non fait, c'est l'API qui le dit ; le quadrant d'un pas,
 * elle ne le rend pas encore (docs/technical/data-flow.md).
 */
export function withObjectiveViews() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({ objectives, tasks }) => {
      const cards = computed(() => toObjectiveCards(objectives(), tasks()));
      return {
        /** Les objectifs en marche (non accomplis). */
        objectiveCards: computed(() => cards().filter((card) => !card.accomplished)),
        /** Les objectifs que l'API dit faits, pour la liste repliée « Accomplis ». */
        accomplishedObjectives: computed(() => cards().filter((card) => card.accomplished)),
        /** Les objectifs racines en { valeur, libelle }, pour e-selection. */
        objectiveOptions: computed(() => rootObjectiveOptions(objectives())),
      };
    }),
    withMethods(({ objectives, tasks }) => ({
      /** La vue détaillée d'un objectif pour l'arête ; undefined tant qu'il n'est pas chargé. Réactive dans un computed. */
      objectiveDetail: (objectiveId: string) => toObjectiveDetail(objectiveId, objectives(), tasks()),
      /** Les étapes d'un objectif en { valeur, libelle }, pour e-selection. Réactive dans un computed. */
      stageOptions: (objectiveId: string) => stageOptions(objectiveId, objectives()),
    }))
  );
}
