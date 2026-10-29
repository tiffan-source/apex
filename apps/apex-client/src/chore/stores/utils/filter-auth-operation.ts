import { Signal } from "@angular/core";
import { filter, MonoTypeOperatorFunction } from "rxjs";

/**
 * Laisse passer un geste seulement quand une personne est connectée : sans session, l'API le refuserait
 * (401). Aucun identifiant n'accompagne le geste : l'API reconnaît la personne à son jeton.
 */
export function whenSignedIn<T>(
  isAuthenticated: Signal<boolean>,
  onSignedOut: () => void = () => console.warn('Action annulée : personne n’est connecté')
): MonoTypeOperatorFunction<T> {
  return filter(() => {
    if (isAuthenticated()) return true;
    onSignedOut();
    return false;
  });
}
