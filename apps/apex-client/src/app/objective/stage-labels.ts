import type { EtatEtape } from '@empreinte-studio/angular/arete';
import type { OptionSelection } from '@empreinte-studio/angular/selection';

/*
 * Les libellés d'une étape, partagés par l'écran de l'arête et ses feuilles.
 */

/**
 * Le nom d'une étape qui n'en a pas (données d'avant la migration : l'ancien écran affichait
 * « Sous-objectif sans titre ») : elle reste lisible sur l'arête et dans les choix, et modifiable.
 */
export const UNTITLED_STAGE = 'Étape sans nom';

/** L'état d'une étape dans son repère : « Étape 3 · en cours ». */
export const STAGE_STATE_LABELS: Readonly<Record<EtatEtape, string>> = {
  faite: 'faite',
  'en-cours': 'en cours',
  'a-venir': 'à venir',
};

/** Le nom affiché d'une étape. */
export function stageName(title: string): string {
  return title.trim() || UNTITLED_STAGE;
}

/** Les étapes d'un objectif pour e-selection, sans option vide. */
export function namedStageOptions(options: readonly OptionSelection<string>[]): OptionSelection<string>[] {
  return options.map((option) => (option.libelle.trim() ? option : { ...option, libelle: UNTITLED_STAGE }));
}
