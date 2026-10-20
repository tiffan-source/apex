import { map, OperatorFunction, pipe } from "rxjs";
import type { ObjectiveViewModel, TaskViewModel } from "../../models/objective.viewmodel";

/** Le préfixe des identifiants optimistes. */
export const TEMPORARY_ID_PREFIX = 'temp-id-';

/** Vrai pour un identifiant optimiste, pas encore enregistré : à ne jamais mettre dans une URL. */
export function isTemporaryId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(TEMPORARY_ID_PREFIX);
}

/** Donne à chaque geste un identifiant temporaire pour l'élément qu'il crée. */
export function withOptimistiqueId<T>() : OperatorFunction<T, T & {tempId: string}> {
  return pipe(
    map((data)=>({...data, tempId: TEMPORARY_ID_PREFIX + crypto.randomUUID()}))
  )
}

/**
 * Un objectif (ou une étape) enregistré reçoit son id définitif : lui, ses étapes et ses pas
 * (créés entre-temps sur l'id temporaire) suivent. Le reste de l'objet optimiste est gardé :
 * un geste fait pendant l'enregistrement part ensuite, dans la file d'écritures.
 */
export function swapObjectiveId(
  state: { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] },
  temporaryId: string,
  realId: string,
): { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] } {
  return {
    objectives: state.objectives.map((objective) => ({
      ...objective,
      id: objective.id === temporaryId ? realId : objective.id,
      parentId: objective.parentId === temporaryId ? realId : objective.parentId,
    })),
    tasks: state.tasks.map((task) => (task.objectiveId === temporaryId ? { ...task, objectiveId: realId } : task)),
  };
}

/** Un pas enregistré reçoit son id définitif ; son état optimiste (fait, niveaux…) est gardé. */
export function swapTaskId(tasks: TaskViewModel[], temporaryId: string, realId: string): TaskViewModel[] {
  return tasks.map((task) => (task.id === temporaryId ? { ...task, id: realId } : task));
}
