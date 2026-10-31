import { DOCUMENT } from '@angular/common';
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import type { PreferenceTheme, ThemeActif } from './types';

/** La clé du thème retenu, lue aussi par le script d'index.html (pas d'éclair de Jour en Nuit). */
export const CLE_THEME = 'apex:theme';
/** La clé du temps d'Empreinte : un choix déjà retenu n'est pas perdu. */
const ANCIENNE_CLE_THEME = 'empreinte:theme';

function lire(): PreferenceTheme | null {
  try {
    const valeur = localStorage.getItem(CLE_THEME) ?? localStorage.getItem(ANCIENNE_CLE_THEME);
    return valeur === 'jour' || valeur === 'nuit' || valeur === 'systeme' ? valeur : null;
  } catch {
    return null;
  }
}

/**
 * Le thème d'Apex : Jour, Nuit ou « Comme l'appareil ». Pose data-theme sur <html> et retient le choix.
 */
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  private readonly sombre = signal(this.mediaSombre()?.matches ?? false);

  readonly preference = signal<PreferenceTheme>(lire() ?? 'jour');
  readonly actif = computed<ThemeActif>(() => {
    const preference = this.preference();
    if (preference === 'systeme') return this.sombre() ? 'nuit' : 'jour';
    return preference;
  });

  constructor() {
    this.mediaSombre()?.addEventListener?.('change', (evenement) => this.sombre.set(evenement.matches));
    effect(() => this.document.documentElement.setAttribute('data-theme', this.actif()));
    effect(() => {
      const preference = this.preference();
      try {
        localStorage.setItem(CLE_THEME, preference);
      } catch {
        /* stockage indisponible : le choix vaut pour la session */
      }
    });
  }

  definir(preference: PreferenceTheme): void {
    this.preference.set(preference);
  }

  basculer(): void {
    this.preference.set(this.actif() === 'nuit' ? 'jour' : 'nuit');
  }

  private mediaSombre(): MediaQueryList | null {
    const vue = this.document.defaultView;
    return typeof vue?.matchMedia === 'function' ? vue.matchMedia('(prefers-color-scheme: dark)') : null;
  }
}
