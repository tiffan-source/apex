import type { EtapeArete } from '@empreinte-studio/angular/arete';

/*
 * La vue détaillée d'un objectif pour l'écran de l'arête (cahier de migration, § 4).
 * Trois niveaux : l'objectif, ses étapes (sous-objectifs directs), leurs pas (tâches).
 * Les sous-objectifs plus profonds ne sont pas montrés : leurs pas sont rangés dans leur étape.
 * Rien n'y est calculé au-delà de ce que l'API rend : ni état d'étape, ni progression, ni quadrant.
 */

/** Un pas dans l'arête. */
export type StageTaskViewModel = {
  id: string;
  title: string;
  done: boolean;
  importance: number;
  urgency: number;
  /** L'objectif qui porte réellement le pas (l'étape, ou un sous-objectif plus profond) : à repasser à editTask. */
  objectiveId: string;
};

/** Une étape d'un objectif. */
export type StageViewModel = {
  id: string;
  title: string;
  description: string;
  /** L'échéance au format ISO, ou vide. */
  dueDate: string;
  /** « Jusqu'en mai », ou vide sans échéance. */
  horizon: string;
  /** La place de l'étape, de 1 à n : « Étape 3 ». */
  index: number;
  /** Ses pas, y compris ceux de ses sous-objectifs plus profonds, dans l'ordre de chargement. */
  tasks: StageTaskViewModel[];
  /** « 3 pas », ou « Aucun pas pour l'instant ». */
  detail: string;
};

/** Une étape prête pour <e-arete>, avec son id pour retrouver l'étape choisie. */
export type AreteStageViewModel = EtapeArete & {
  readonly id: string;
};

export type ObjectiveDetailViewModel = {
  objective: {
    id: string;
    title: string;
    why: string;
    description: string;
    /** L'échéance au format ISO, ou vide. */
    dueDate: string;
    /** « Jusqu'en mai », « Jusqu'en mai 2027 », ou vide. */
    horizon: string;
  };
  /** Les étapes, dans l'ordre de chargement. */
  stages: StageViewModel[];
  /** Les pas posés directement sur l'objectif, à ranger dans une étape. */
  tasksWithoutStage: StageTaskViewModel[];
  /** Les étapes pour <e-arete [etapes]>, dans le même ordre que stages ; une étape sans nom y est « Étape sans nom ». */
  aretes: AreteStageViewModel[];
  /** L'étape ouverte par défaut : la première, ou null (aucune étape). */
  defaultStageId: string | null;
  /** Le nombre de pas de l'objectif et de toutes ses étapes. */
  taskCount: number;
};
