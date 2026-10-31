import type { EtatEtape } from '../../ui';
import type { OptionSelection } from '../../ui';

import { UNTITLED_STAGE } from '../../chore/mapper/objective-view.mapper';

/*
 * Les libellés d'une étape, partagés par l'écran de l'arête, ses feuilles et Akari. Le nom d'une étape sans
 * nom (UNTITLED_STAGE, stageName) vient du mapper des vues, qui le pose aussi sur l'arête.
 */
export { UNTITLED_STAGE, stageName } from '../../chore/mapper/objective-view.mapper';

/** L'état d'une étape dans son repère : « Étape 3 · en cours ». */
export const STAGE_STATE_LABELS: Readonly<Record<EtatEtape, string>> = {
  faite: 'faite',
  'en-cours': 'en cours',
  'a-venir': 'à venir',
};

/** L'état d'une étape seul sur sa ligne (la liste des étapes d'Akari) : « En cours ». */
export const STAGE_STATE_TITLES: Readonly<Record<EtatEtape, string>> = {
  faite: 'Faite',
  'en-cours': 'En cours',
  'a-venir': 'À venir',
};

/** Les étapes d'un objectif pour ax-select, sans option vide. */
export function namedStageOptions(options: readonly OptionSelection<string>[]): OptionSelection<string>[] {
  return options.map((option) => (option.libelle.trim() ? option : { ...option, libelle: UNTITLED_STAGE }));
}
