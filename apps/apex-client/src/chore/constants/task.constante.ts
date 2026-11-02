import type { OptionSelection } from '@empreinte-studio/angular/selection';

/*
 * Les niveaux d'importance et d'urgence d'un pas (1 à 5), tels que l'API les garde, avec leur nom pour
 * e-selection. Ce que ces niveaux décident (le quadrant d'un pas, son rang) relève d'Apex Brain.
 */

/** L'importance d'un pas, de 1 à 5. */
export const IMPORTANCE_OPTIONS: readonly OptionSelection<number>[] = [
  { valeur: 1, libelle: 'Accessoire' },
  { valeur: 2, libelle: 'Secondaire' },
  { valeur: 3, libelle: 'Important' },
  { valeur: 4, libelle: 'Très important' },
  { valeur: 5, libelle: 'Essentiel' },
];

/** L'urgence d'un pas, de 1 à 5. */
export const URGENCY_OPTIONS: readonly OptionSelection<number>[] = [
  { valeur: 1, libelle: 'Rien ne presse' },
  { valeur: 2, libelle: 'Pas urgent' },
  { valeur: 3, libelle: 'Urgent' },
  { valeur: 4, libelle: 'Très urgent' },
  { valeur: 5, libelle: 'Tout de suite' },
];

/** Les niveaux choisis d'avance dans la feuille « Ajouter un pas » (« Important », « Pas urgent ») : la personne les change. */
export const NEW_TASK_LEVELS: Readonly<{ importance: number; urgency: number }> = { importance: 3, urgency: 2 };
