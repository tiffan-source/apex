import type { EtatPas } from '../../ui';
import type { EtapeArete, EtatEtape } from '../../ui';
import type { Quadrant } from '../../ui';
import type { TaskCountViewModel } from './objective-card.viewmodel';

/*
 * La vue détaillée d'un objectif pour l'écran de l'arête (cahier de migration, § 4).
 * Trois niveaux : l'objectif, ses étapes (sous-objectifs directs), leurs pas (tâches).
 * Les sous-objectifs plus profonds ne sont pas montrés : leurs pas comptent dans leur étape.
 */

/** Un pas dans l'arête. */
export type StageTaskViewModel = {
  id: string;
  title: string;
  done: boolean;
  /** « fait », « en-cours » (le premier pas non fait de l'étape en cours) ou « a-venir ». */
  state: EtatPas;
  importance: number;
  urgency: number;
  /** L'objectif qui porte réellement le pas (l'étape, ou un sous-objectif plus profond) : à repasser à editTask. */
  objectiveId: string;
  quadrant: Quadrant;
};

/** Ce qu'une étape compte, prêt pour ax-steps : faits, un en cours, à venir (sans celui en cours). */
export type StageTaskProgressViewModel = {
  done: number;
  inProgress: boolean;
  upcoming: number;
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
  state: EtatEtape;
  /** La place de l'étape, de 1 à n : « Étape 3 · en cours ». */
  index: number;
  /** Ses pas, y compris ceux de ses sous-objectifs plus profonds, dans l'ordre de chargement. */
  tasks: StageTaskViewModel[];
  progress: StageTaskProgressViewModel;
  /** « 4 pas faits · 3 à venir » (legendeProgression, ui/voice.ts), ou « Aucun pas pour l'instant ». */
  detail: string;
};

/** Une étape prête pour <ax-path>, avec son id pour retrouver l'étape choisie. */
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
  /** Les étapes pour <ax-path [steps]>, dans le même ordre que stages ; une étape sans nom y est « Étape sans nom ». */
  aretes: AreteStageViewModel[];
  /** L'étape ouverte par défaut : celle en cours, sinon la dernière, sinon null (aucune étape). */
  defaultStageId: string | null;
  taskCount: TaskCountViewModel;
};
