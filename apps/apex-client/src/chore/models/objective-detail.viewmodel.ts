import type { EtapeArete } from '@empreinte-studio/angular/arete';
import type { TaskCountViewModel } from './objective-card.viewmodel';

/*
 * La vue détaillée d'un objectif pour l'écran de l'arête (cahier de migration, § 4).
 * Trois niveaux : l'objectif, ses étapes (sous-objectifs directs), leurs pas (tâches).
 * Les sous-objectifs plus profonds ne sont pas montrés : leurs pas comptent dans leur étape.
 * Étapes et pas sont indépendants : aucun ordre entre eux, l'écran n'en choisit aucun.
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

/** Ce qu'une étape compte, prêt pour e-pas : faits, à faire. */
export type StageTaskProgressViewModel = {
  done: number;
  toDo: number;
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
  /** Faite ou à faire, tel que l'API le dit. */
  done: boolean;
  /** Ses pas, y compris ceux de ses sous-objectifs plus profonds. */
  tasks: StageTaskViewModel[];
  progress: StageTaskProgressViewModel;
  /** « 4 pas faits · 3 à faire » (legendeProgression d'Empreinte), ou « Aucun pas pour l'instant ». */
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
  stages: StageViewModel[];
  /** Les pas posés directement sur l'objectif, à ranger dans une étape. */
  tasksWithoutStage: StageTaskViewModel[];
  /** Les étapes pour <e-arete [etapes]> ; une étape sans nom y est « Étape sans nom ». */
  aretes: AreteStageViewModel[];
  taskCount: TaskCountViewModel;
};
