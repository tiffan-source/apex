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
 * requestStatus (et error()) ne disent que le dernier chargement : les écritures n'y touchent pas, elles passent par
 * l'écriture optimiste (utils/optimistic-writes.ts) et leurs notes. objectivesLoaded, lui, ne revient pas à faux quand
 * une relecture échoue après un premier chargement réussi. Les écrans le lisent avant d'afficher un état vide (Objectifs) ou « Cet objectif
 * est introuvable » (l'arête, Akari) ; tant qu'il est faux, ils n'affirment rien : pendant le chargement,
 * ou après un chargement qui n'a pas abouti, dont la coque affiche déjà le signalement.
 */
export function withObjectivesLoaded() {
  return signalStoreFeature(withState<ObjectivesLoadedState>({ objectivesLoaded: false }));
}
