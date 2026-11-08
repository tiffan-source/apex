import type { OptionSelection } from '@empreinte-studio/angular/selection';

import { UNTITLED_STAGE } from '../../chore/mapper/objective-view.mapper';

/*
 * Les libellés d'une étape, partagés par l'écran de l'arête, ses feuilles et Akari. Le nom d'une étape sans
 * nom (UNTITLED_STAGE, stageName) vient du mapper des vues, qui le pose aussi sur l'arête.
 */
export { UNTITLED_STAGE, stageName } from '../../chore/mapper/objective-view.mapper';

/**
 * Ce que dit un élément encore en création : visible tout de suite, inactif jusqu'à ce que l'API l'enregistre (aucun
 * geste ne le vise avant).
 */
export const SAVING_LABELS = {
  stage: "J'enregistre cette étape…",
  task: "J'enregistre ce pas…",
} as const;

/** Ce que l'API dit d'une étape, dans son repère : « Étape · à faire ». */
export function stageStateLabel(done: boolean): string {
  return done ? 'faite' : 'à faire';
}

/** Ce que l'API dit d'une étape, seul sur sa ligne (la liste des étapes d'Akari) : « À faire ». */
export function stageStateTitle(done: boolean): string {
  return done ? 'Faite' : 'À faire';
}

/** Ce que la légende d'une étape ajoute à son compte de pas, quand l'API dit qu'elle est faite. */
export function stageAccomplishment(done: boolean): string | undefined {
  return done ? 'étape accomplie' : undefined;
}

/** Les étapes d'un objectif pour e-selection, sans option vide. */
export function namedStageOptions(options: readonly OptionSelection<string>[]): OptionSelection<string>[] {
  return options.map((option) => (option.libelle.trim() ? option : { ...option, libelle: UNTITLED_STAGE }));
}
