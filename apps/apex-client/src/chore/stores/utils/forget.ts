import type { ObjectiveViewModel, TaskViewModel } from "../../models/objective.viewmodel";
import { subtreeIds } from "../../mapper/objective-view.mapper";

/*
 * Une commande répond 404 (OBJECTIVE_NOT_FOUND, TASK_NOT_FOUND) : l'élément n'existe plus côté serveur (effacé
 * dans un autre onglet, par Akari…). L'écran le retire, sans relire l'arbre.
 */

/** L'état sans cet objectif (ou cette étape), ses étapes et leurs pas. */
export function forgetObjective(
  state: { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] },
  objectiveId: string,
): { objectives: ObjectiveViewModel[]; tasks: TaskViewModel[] } {
  const ids = subtreeIds(objectiveId, state.objectives);
  return {
    objectives: state.objectives.filter((objective) => !ids.has(objective.id)),
    tasks: state.tasks.filter((task) => !ids.has(task.objectiveId)),
  };
}

/** Les pas sans celui-ci. */
export function forgetTask(tasks: TaskViewModel[], taskId: string): TaskViewModel[] {
  return tasks.filter((task) => task.id !== taskId);
}
