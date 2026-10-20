import type { Quadrant } from '@empreinte-studio/angular/matrice';
import type { TaskViewModel } from './objective.viewmodel';

/** Un pas dans la matrice d'Eisenhower, avec de quoi écrire sa ligne de détail et filtrer par objectif. */
export type MatrixTaskViewModel = TaskViewModel & {
  quadrant: Quadrant;
  /** L'objectif racine du pas (pour filtrer la matrice). */
  rootObjectiveId: string;
  rootObjectiveTitle: string;
  /** L'étape du pas (sous-objectif direct de la racine), ou null pour un pas posé sur l'objectif. */
  stageId: string | null;
  stageTitle: string | null;
};

/** Les pas de chaque quadrant, prêts pour <e-matrice [quadrants]>. */
export type MatrixViewModel = Record<Quadrant, MatrixTaskViewModel[]>;
