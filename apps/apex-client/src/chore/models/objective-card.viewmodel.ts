/*
 * La carte d'un objectif sur l'écran Objectifs (cahier de migration, § 4).
 * La progression se lit par étapes : ce qui est fait, l'étape en cours, ce qui vient.
 */

/** La progression d'un objectif par étapes, prête pour e-pas / eCarteObjectif (unite="etape"). */
export type StageProgressViewModel = {
  /** Les étapes faites. */
  done: number;
  /** Une étape est en cours (une seule par objectif). */
  inProgress: boolean;
  /** Les étapes à venir, sans compter celle en cours. */
  upcoming: number;
  /** Le titre de l'étape en cours, s'il y en a une. */
  inProgressName?: string;
};

/** Les pas d'un objectif (et de toutes ses étapes) : faits sur le total. */
export type TaskCountViewModel = {
  done: number;
  total: number;
};

/** Le prochain pas d'un objectif. */
export type NextTaskViewModel = {
  id: string;
  title: string;
  done: boolean;
};

export type ObjectiveCardViewModel = {
  id: string;
  title: string;
  /** Le « pourquoi », à écrire en voix entre « ». Vide s'il n'a pas été dit. */
  why: string;
  /** « Jusqu'en mai », « Jusqu'en mai 2027 », ou vide sans échéance. */
  horizon: string;
  stageProgress: StageProgressViewModel;
  /** Le nombre d'étapes (sous-objectifs directs). */
  stageCount: number;
  taskCount: TaskCountViewModel;
  /** Le premier pas non fait de l'étape en cours, sinon de l'objectif ; null s'il n'y en a pas. */
  nextTask: NextTaskViewModel | null;
  /** Au moins un pas, et tous faits. */
  accomplished: boolean;
};
