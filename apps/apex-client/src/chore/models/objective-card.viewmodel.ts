/*
 * La carte d'un objectif sur l'écran Objectifs (cahier de migration, § 4).
 * La progression se lit par étapes : ce qui est fait, ce qui est à faire, sans ordre entre elles.
 */

/** La progression d'un objectif par étapes, prête pour e-pas (unite="etape"). */
export type StageProgressViewModel = {
  /** Les étapes faites. */
  done: number;
  /** Les étapes à faire. */
  toDo: number;
};

/** Les pas d'un objectif (et de toutes ses étapes) : faits sur le total. */
export type TaskCountViewModel = {
  done: number;
  total: number;
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
  /** L'objectif est fait, d'après l'API. */
  accomplished: boolean;
};
