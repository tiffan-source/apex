import type { OptionSelection } from '@empreinte-studio/angular/selection';

/*
 * Les niveaux d'importance et d'urgence d'un pas (1 à 5), prêts pour e-selection.
 * Le seuil de la matrice est 3 (ApexLibsMetier.getEisenhowerCategory) : à partir de 3, un pas
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
 * @deprecated Ancienne forme { label, value } des anciennes listes, gardée le temps que les écrans
 * passent à e-selection. Utilise IMPORTANCE_OPTIONS.
 */
export const ImportanceValueOption: { label: string; value: number }[] = IMPORTANCE_OPTIONS.map(
  ({ valeur, libelle }) => ({ label: libelle, value: valeur }),
);

/**
 * @deprecated Ancienne forme { label, value } des anciennes listes, gardée le temps que les écrans
 * passent à e-selection. Utilise URGENCY_OPTIONS.
 */
export const UrgencyValueOption: { label: string; value: number }[] = URGENCY_OPTIONS.map(
  ({ valeur, libelle }) => ({ label: libelle, value: valeur }),
);
