import type { OptionSelection } from '@empreinte-studio/angular/selection';

/*
 * Les niveaux d'importance et d'urgence d'un pas (1 à 5), prêts pour e-selection.
 * Le seuil de la matrice est 3 (EISENHOWER_THRESHOLD, matrix.mapper.ts) : à partir de 3, un pas
 * est « important » ou « urgent ». Les libellés suivent les axes de la matrice d'Empreinte.
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

/**
 * Les niveaux d'un nouveau pas : important, pas urgent, donc « À planifier ». Le brand book d'Empreinte en
 * fait le cœur de la progression : c'est là qu'on place les pas des objectifs. La personne les change dans
 * la feuille « Ajouter un pas », ou plus tard en déplaçant le pas dans la matrice (cahier de migration, § 4).
 */
export const NEW_TASK_LEVELS: Readonly<{ importance: number; urgency: number }> = { importance: 3, urgency: 2 };
