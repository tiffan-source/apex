import type { ObjectiveOutput, ObjectivesResponse, TaskOutput } from "../api/api.models";
import { ObjectiveViewModel, TaskViewModel } from "../models/objective.viewmodel";
import { ObjectiveState } from "../stores/objective.store";

/** Une échéance de l'API (ISO 8601) au format de l'état (ISO, en UTC) ; vide sans échéance ou illisible. */
function toIsoDueDate(dueDate: string | null): string {
  if (!dueDate) return "";
  const date = new Date(dueDate);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** De la réponse de GET /v1/objectives aux modèles de l'état d'ObjectiveStore. */
export class ObjectiveMapper {

  private static toTaskViewModel(task: TaskOutput): TaskViewModel {
    return {
      id: task.id,
      title: task.title,
      importance: task.importance,
      urgency: task.urgency,
      done: task.done,
      objectiveId: task.objectiveId,
    };
  }

  private static toObjectiveViewModel(objective: ObjectiveOutput): ObjectiveViewModel {
    return {
      id: objective.id,
      title: objective.title,
      why: objective.why ?? "",
      dueDate: toIsoDueDate(objective.dueDate),
      description: objective.description ?? "",
      parentId: objective.parentObjective
    };
  }

  public static fromLoadToObjectiveViewModels(
    input: ObjectivesResponse
  ): ObjectiveState {
    return {
      objectives: input.objectives.map(ObjectiveMapper.toObjectiveViewModel),
      tasks: input.tasks.map(ObjectiveMapper.toTaskViewModel),
    };
  }
}
