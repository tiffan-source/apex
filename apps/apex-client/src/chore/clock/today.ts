import { DestroyRef, NgZone, inject, signal, type Signal } from '@angular/core';
import { toDateInputValue } from '../mapper/date-input.mapper';

/*
 * Le jour du repère des écrans (« Lundi 19 octobre » : Objectifs, la matrice). Un seul format, une seule
 * horloge : le repère change à minuit, même si l'onglet reste ouvert.
 */

/** Toutes les minutes, l'écran vérifie que le repère dit encore la date du jour. */
export const TODAY_CHECK_INTERVAL = 60_000;

const DAY = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });

/** « Lundi 19 octobre ». */
export function formatToday(date: Date): string {
  const text = DAY.format(date);
  return text.charAt(0).toLocaleUpperCase('fr') + text.slice(1);
}

/**
 * Le jour courant, qui change à minuit. À appeler dans un contexte d'injection (constructeur ou champ d'un
 * composant) : la vérification s'arrête avec le composant. Hors de la zone, le minuteur permanent n'empêche
 * pas l'application d'être stable ; le signal ne change qu'au changement de jour, et alors dans la zone.
 * Pour l'attribut datetime : toDateInputValue(today()), « AAAA-MM-JJ » en heure locale.
 */
export function injectToday(): Signal<Date> {
  const today = signal(new Date());
  const zone = inject(NgZone);
  const timer = zone.runOutsideAngular(() =>
    setInterval(() => {
      const now = new Date();
      if (toDateInputValue(now) !== toDateInputValue(today())) zone.run(() => today.set(now));
    }, TODAY_CHECK_INTERVAL),
  );
  inject(DestroyRef).onDestroy(() => clearInterval(timer));
  return today.asReadonly();
}
