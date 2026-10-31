/*
 * Les types partagés du kit d'Apex : étapes, pas, quadrants, options des contrôles.
 */

/** Les quatre lumières : la couleur d'un objectif. */
export type Lumiere = 'ciel' | 'aube' | 'soleil' | 'fjord';
export const LUMIERES: readonly Lumiere[] = ['ciel', 'fjord', 'soleil', 'aube'];

/** La lumière d'un objectif, tirée de son id : toujours la même d'un écran à l'autre. */
export function lumiereDe(id: string): Lumiere {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return LUMIERES[hash % LUMIERES.length];
}

/** L'état d'un pas dans une progression. */
export type EtatPas = 'fait' | 'en-cours' | 'a-venir';

/** L'état d'une étape sur le chemin. */
export type EtatEtape = 'faite' | 'en-cours' | 'a-venir';

/** Une étape du chemin d'un objectif. */
export interface EtapeArete {
  nom: string;
  etat: EtatEtape;
  detail?: string;
}

/** Une option d'une liste déroulante. */
export interface OptionSelection<T> {
  valeur: T;
  libelle: string;
  desactivee?: boolean;
}

/** Une option d'une rangée de filtres. */
export interface OptionFiltre<V> {
  valeur: V;
  libelle: string;
  lumiere?: Lumiere;
}

/** Une action d'un menu. */
export interface ElementMenu<V> {
  valeur: V;
  libelle: string;
  icone?: string;
  doux?: boolean;
  desactive?: boolean;
}
export interface SeparateurMenu {
  separateur: true;
}
export type EntreeMenu<V> = ElementMenu<V> | SeparateurMenu;

/** Les quatre quadrants de la matrice. */
export type Quadrant = 'maintenant' | 'planifier' | 'confier' | 'laisser-filer';
export const QUADRANTS: readonly Quadrant[] = ['maintenant', 'planifier', 'confier', 'laisser-filer'];
export const TITRES_QUADRANTS: Readonly<Record<Quadrant, string>> = {
  maintenant: 'Maintenant',
  planifier: 'À planifier',
  confier: 'À confier',
  'laisser-filer': 'À laisser filer',
};

/** Un élément déplacé d'un quadrant à un autre (index dans le quadrant d'arrivée). */
export interface DeplacementMatrice<T> {
  element: T;
  de: Quadrant;
  vers: Quadrant;
  index: number;
}

/** De nouveaux quadrants après un déplacement, sans muter ceux reçus. */
export function appliquerDeplacement<T>(
  quadrants: Readonly<Record<Quadrant, readonly T[]>>,
  deplacement: DeplacementMatrice<T>,
  piste: (element: T) => unknown = (element) => element,
): Record<Quadrant, T[]> {
  const cle = piste(deplacement.element);
  const suivants = Object.fromEntries(
    QUADRANTS.map((q) => [q, quadrants[q].filter((element) => piste(element) !== cle)]),
  ) as Record<Quadrant, T[]>;
  const arrivee = suivants[deplacement.vers];
  arrivee.splice(Math.max(0, Math.min(deplacement.index, arrivee.length)), 0, deplacement.element);
  return suivants;
}

/** Le choix de thème de la personne. */
export type PreferenceTheme = 'jour' | 'nuit' | 'systeme';
export type ThemeActif = 'jour' | 'nuit';
