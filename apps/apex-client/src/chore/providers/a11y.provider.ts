import { DOCUMENT } from '@angular/common';
import { inject, Provider } from '@angular/core';
import { LIVE_ANNOUNCER_ELEMENT_TOKEN } from '@angular/cdk/a11y';

/**
 * La zone où le LiveAnnouncer du CDK écrit ses annonces (AnnoncesStore, composants d'Empreinte).
 * Le CDK la masque par .cdk-visually-hidden, mais le LiveAnnouncer, contrairement aux autres briques
 * du CDK, ne charge pas cette feuille : l'annonce s'afficherait en bas de page. On lui donne une zone
 * masquée par e-masque, l'utilitaire d'Empreinte toujours chargé (@empreinte-studio/tokens, base.css).
 */
export function createLiveAnnouncerElement(document: Document): HTMLElement {
  const element = document.createElement('div');
  element.classList.add('e-masque');
  element.setAttribute('aria-live', 'polite');
  element.setAttribute('aria-atomic', 'true');
  document.body.appendChild(element);
  return element;
}

export const A11yProviders: Provider[] = [
  { provide: LIVE_ANNOUNCER_ELEMENT_TOKEN, useFactory: () => createLiveAnnouncerElement(inject(DOCUMENT)) },
];
