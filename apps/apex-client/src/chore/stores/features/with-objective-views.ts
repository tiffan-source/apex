import { computed } from "@angular/core";
import { signalStoreFeature, type, withComputed, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import {
  rootObjectiveOptions,
  stageOptions,
  toObjectiveCards,
  toObjectiveDetail,
} from "../../mapper/objective-view.mapper";
import { filterMatrixByObjective, toMatrix } from "../../mapper/matrix.mapper";

/**
 * Les vues des écrans, dérivées de l'état (cahier de migration, § 4) :
 * cartes d'objectifs, vue détaillée pour l'arête, matrice, options des champs.
 */
export function withObjectiveViews() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({ objectives, tasks }) => {
      const cards = computed(() => toObjectiveCards(objectives(), tasks()));
      return {
        /** Les objectifs en marche (non accomplis), dans l'ordre de chargement. */
        objectiveCards: computed(() => cards().filter((card) => !card.accomplished)),
        /** Les objectifs accomplis (au moins un pas, tous faits), pour la liste repliée « Accomplis ». */
        accomplishedObjectives: computed(() => cards().filter((card) => card.accomplished)),
        /** Tous les pas par quadrant, pour <ax-matrix [quadrants]> (filtrer avec filterMatrixByObjective). */
        matrix: computed(() => toMatrix(objectives(), tasks())),
        /** Les objectifs racines en { valeur, libelle }, pour ax-filters (matrice) ou ax-select. */
        objectiveOptions: computed(() => rootObjectiveOptions(objectives())),
      };
    }),
    withMethods(({ objectives, tasks, matrix }) => ({
      /** La matrice d'un objectif racine, ou de tous (null). Réactive dans un computed. */
      matrixFor: (rootObjectiveId: string | null) => filterMatrixByObjective(matrix(), rootObjectiveId),
      /** La vue détaillée d'un objectif pour l'arête ; undefined tant qu'il n'est pas chargé. Réactive dans un computed. */
      objectiveDetail: (objectiveId: string) => toObjectiveDetail(objectiveId, objectives(), tasks()),
      /** Les étapes d'un objectif en { valeur, libelle }, pour ax-select. Réactive dans un computed. */
      stageOptions: (objectiveId: string) => stageOptions(objectiveId, objectives()),
    }))
  );
}
