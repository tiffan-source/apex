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
 * détaillée pour l'arête, options des champs. Elles ne calculent ni progression ni quadrant : l'API ne les
 * rend pas encore (docs/technical/data-flow.md).
 */
export function withObjectiveViews() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({ objectives, tasks }) => ({
      /** Les objectifs racines, en cartes, dans l'ordre de chargement. */
      objectiveCards: computed(() => toObjectiveCards(objectives(), tasks())),
      /** Les objectifs racines en { valeur, libelle }, pour e-selection. */
      objectiveOptions: computed(() => rootObjectiveOptions(objectives())),
    })),
    withMethods(({ objectives, tasks }) => ({
      /** La vue détaillée d'un objectif pour l'arête ; undefined tant qu'il n'est pas chargé. Réactive dans un computed. */
      objectiveDetail: (objectiveId: string) => toObjectiveDetail(objectiveId, objectives(), tasks()),
      /** Les étapes d'un objectif en { valeur, libelle }, pour e-selection. Réactive dans un computed. */
      stageOptions: (objectiveId: string) => stageOptions(objectiveId, objectives()),
    }))
  );
}
