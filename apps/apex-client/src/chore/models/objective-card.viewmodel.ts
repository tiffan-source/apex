/*
 * La carte d'un objectif sur l'écran Objectifs (cahier de migration, § 4). Elle montre ce que l'API rend :
 * l'objectif, son horizon, son pourquoi, et ce qu'il porte (ses étapes, ses pas). Sa progression (étapes
 * faites, prochain pas, objectif accompli) relève d'Apex Brain : le client ne la calcule pas, et la carte
 * ne la montre pas tant que l'API ne la rend pas.
 */
export type ObjectiveCardViewModel = {
  id: string;
  title: string;
  /** Le « pourquoi », à écrire en voix entre « ». Vide s'il n'a pas été dit. */
  why: string;
  /** « Jusqu'en mai », « Jusqu'en mai 2027 », ou vide sans échéance. */
  horizon: string;
  /** Le nombre d'étapes (sous-objectifs directs). */
  stageCount: number;
  /** Le nombre de pas de l'objectif et de toutes ses étapes. */
  taskCount: number;
};
