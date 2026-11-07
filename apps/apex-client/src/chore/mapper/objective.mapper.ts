import type {
  ObjectiveEntity,
  ObjectiveTreeNode,
  ObjectiveTreeResponse,
  ObjectiveTreeTask,
  TaskEntity,
} from "../api/api.models";
import { ObjectiveViewModel, TaskViewModel } from "../models/objective.viewmodel";
import { ObjectiveState } from "../stores/objective.store";

/** Une échéance de l'API (ISO 8601) au format de l'état (ISO, en UTC) ; vide sans échéance ou illisible. */
function toIsoDueDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/**
 * De ce que rend l'API (l'arbre de GET /v2/bff/objective-tree, l'objectif ou le pas rendu par une commande) aux
 * modèles de l'état d'ObjectiveStore, qui garde objectifs, étapes et pas à plat.
 */
export class ObjectiveMapper {

  /** Un pas rendu par une commande. */
  public static toTaskViewModel(task: TaskEntity): TaskViewModel {
    return {
      id: task.id,
      title: task.title,
      importance: task.importance,
      urgency: task.urgency,
      done: task.done,
      objectiveId: task.objectiveId,
    };
  }

  /** Un objectif ou une étape rendu par une commande. */
  public static toObjectiveViewModel(objective: ObjectiveEntity): ObjectiveViewModel {
    return {
      id: objective.id,
      title: objective.title,
      why: objective.why ?? "",
      dueDate: toIsoDueDate(objective.dueDate),
      description: objective.description ?? "",
      parentId: objective.parentObjectiveId,
      done: objective.done,
    };
  }

  /** L'arbre à plat : chaque objectif avant ses étapes, chaque étape avant les siennes, dans l'ordre de l'API. */
  public static fromObjectiveTree(input: ObjectiveTreeResponse): ObjectiveState {
    const state: ObjectiveState = { objectives: [], tasks: [] };
    const visit = (node: ObjectiveTreeNode, parentObjectiveId: string | null) => {
      state.objectives.push(ObjectiveMapper.toObjectiveViewModel({ ...node, parentObjectiveId }));
      state.tasks.push(
        ...node.tasks.map((task: ObjectiveTreeTask) => ObjectiveMapper.toTaskViewModel({ ...task, objectiveId: node.id }))
      );
      node.subObjectives.forEach((child) => visit(child, node.id));
    };
    input.objectives.forEach((root) => visit(root, null));
    return state;
  }
}
