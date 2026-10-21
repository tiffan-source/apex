import { signalStoreFeature, withState } from "@ngrx/signals";

export type ObjectivesLoadedState = {
  /**
   * Vrai dès que les objectifs de la personne connectée sont chargés, et jusqu'à la déconnexion.
   * Faux pendant le premier chargement, et après un chargement qui n'a pas abouti.
   */
  objectivesLoaded: boolean;
};

/**
 * La mémoire du chargement des objectifs. `objectivesLoaded` passe à vrai quand loadObjectives
 * (withObjectiveQuery, qui l'écrit : à placer avant lui) a abouti, et revient à faux avec clearObjectives.
 *
 * requestStatus ne peut pas le dire : il est partagé par toutes les actions du store, et chaque écriture
 * le repasse à 'pending', à 'fulfilled' ou à un signalement. objectivesLoaded, lui, ne bouge pas avec les
 * écritures. Les écrans le lisent avant d'afficher un état vide (Objectifs, la matrice) ou « Cet objectif
 * est introuvable » (l'arête, Akari) ; tant qu'il est faux, ils n'affirment rien : pendant le chargement,
 * ou après un chargement qui n'a pas abouti, dont la coque affiche déjà le signalement.
 */
export function withObjectivesLoaded() {
  return signalStoreFeature(withState<ObjectivesLoadedState>({ objectivesLoaded: false }));
}
