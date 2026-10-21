import { ApexLibsMetier, EisenhowerCategory } from '@org/apex-library';
import type { Quadrant } from '@empreinte-studio/angular/matrice';
import type { ObjectiveViewModel, TaskViewModel } from '../models/objective.viewmodel';
import type { MatrixTaskViewModel, MatrixViewModel } from '../models/matrix.viewmodel';

/*
 * La matrice d'Eisenhower d'Empreinte, branchée sur la règle métier d'Apex
 * (ApexLibsMetier.getEisenhowerCategory reste la source : seuil 3 sur l'importance et l'urgence).
 */

/** Le seuil d'ApexLibsMetier : à partir de 3, un pas est important (ou urgent). */
export const EISENHOWER_THRESHOLD = 3;

const CATEGORY_TO_QUADRANT: Readonly<Record<EisenhowerCategory, Quadrant>> = {
  [EisenhowerCategory.DO]: 'maintenant',
  [EisenhowerCategory.SCHEDULE]: 'planifier',
  [EisenhowerCategory.DELEGATE]: 'confier',
  [EisenhowerCategory.DELETE]: 'laisser-filer',
};

const QUADRANT_TO_CATEGORY: Readonly<Record<Quadrant, EisenhowerCategory>> = {
  maintenant: EisenhowerCategory.DO,
  planifier: EisenhowerCategory.SCHEDULE,
  confier: EisenhowerCategory.DELEGATE,
  'laisser-filer': EisenhowerCategory.DELETE,
};

/** Ce que chaque quadrant demande : important ou secondaire, urgent ou pas urgent. */
const QUADRANT_AXES: Readonly<Record<Quadrant, { important: boolean; urgent: boolean }>> = {
  maintenant: { important: true, urgent: true },
  planifier: { important: true, urgent: false },
  confier: { important: false, urgent: true },
  'laisser-filer': { important: false, urgent: false },
};

/** DO → maintenant, SCHEDULE → planifier, DELEGATE → confier, DELETE → laisser-filer. */
export function categoryToQuadrant(category: EisenhowerCategory): Quadrant {
  return CATEGORY_TO_QUADRANT[category];
}

/** Le retour : maintenant → DO, planifier → SCHEDULE, confier → DELEGATE, laisser-filer → DELETE. */
export function quadrantToCategory(quadrant: Quadrant): EisenhowerCategory {
  return QUADRANT_TO_CATEGORY[quadrant];
}

/** Le quadrant d'un pas, selon la règle métier d'Apex. */
export function quadrantOf(levels: { importance: number; urgency: number }): Quadrant {
  return categoryToQuadrant(
    ApexLibsMetier.getEisenhowerCategory({ importance: levels.importance, urgency: levels.urgency }),
  );
}

/**
 * L'importance et l'urgence d'un pas déplacé vers un quadrant, en ne changeant que ce qui doit changer :
 * côté « important » ou « urgent », une valeur sous 3 passe à 3 ; côté « secondaire » ou « pas urgent »,
 * une valeur de 3 ou plus passe à 2. Le reste ne bouge pas.
 */
export function levelsForQuadrant(
  levels: { importance: number; urgency: number },
  quadrant: Quadrant,
): { importance: number; urgency: number } {
  const { important, urgent } = QUADRANT_AXES[quadrant];
  return {
    importance: adjustLevel(levels.importance, important),
    urgency: adjustLevel(levels.urgency, urgent),
  };
}

function adjustLevel(value: number, high: boolean): number {
  if (high) return value < EISENHOWER_THRESHOLD ? EISENHOWER_THRESHOLD : value;
  return value >= EISENHOWER_THRESHOLD ? EISENHOWER_THRESHOLD - 1 : value;
}

/** Une matrice vide, les quadrants dans l'ordre d'Empreinte. */
export function emptyMatrix(): MatrixViewModel {
  return { maintenant: [], planifier: [], confier: [], 'laisser-filer': [] };
}

/**
 * Remonte d'un objectif jusqu'à sa racine : la racine, et l'étape (l'ancêtre juste sous la racine).
 * Un pas posé directement sur la racine n'a pas d'étape.
 */
export function locateInTree(
  objectiveId: string,
  objectivesById: ReadonlyMap<string, ObjectiveViewModel>,
): { root: ObjectiveViewModel | null; stage: ObjectiveViewModel | null } {
  const chain: ObjectiveViewModel[] = [];
  const seen = new Set<string>();
  let current = objectivesById.get(objectiveId);
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    current = current.parentId ? objectivesById.get(current.parentId) : undefined;
  }
  return {
    root: chain.length > 0 ? chain[chain.length - 1] : null,
    stage: chain.length > 1 ? chain[chain.length - 2] : null,
  };
}

/** Tous les pas, rangés par quadrant, chacun avec son objectif racine et son étape. */
export function toMatrix(objectives: readonly ObjectiveViewModel[], tasks: readonly TaskViewModel[]): MatrixViewModel {
  const byId = new Map(objectives.map((objective) => [objective.id, objective] as const));
  const matrix = emptyMatrix();
  for (const task of tasks) {
    const quadrant = quadrantOf(task);
    const { root, stage } = locateInTree(task.objectiveId, byId);
    const item: MatrixTaskViewModel = {
      ...task,
      quadrant,
      rootObjectiveId: root?.id ?? task.objectiveId,
      rootObjectiveTitle: root?.title ?? '',
      stageId: stage?.id ?? null,
      stageTitle: stage?.title ?? null,
    };
    matrix[quadrant].push(item);
  }
  return matrix;
}

/** La matrice d'un seul objectif racine ; null garde tous les objectifs. */
export function filterMatrixByObjective(matrix: MatrixViewModel, rootObjectiveId: string | null): MatrixViewModel {
  if (rootObjectiveId === null) return matrix;
  const keep = (items: MatrixTaskViewModel[]) => items.filter((item) => item.rootObjectiveId === rootObjectiveId);
  return {
    maintenant: keep(matrix.maintenant),
    planifier: keep(matrix.planifier),
    confier: keep(matrix.confier),
    'laisser-filer': keep(matrix['laisser-filer']),
  };
}
