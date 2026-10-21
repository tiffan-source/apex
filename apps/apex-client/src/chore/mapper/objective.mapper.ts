import { ObjectiveOutput, TaskOutput, GetAllObjectiveAndTaskOutput } from "@org/objective";
import { ObjectiveViewModel, TaskViewModel } from "../models/objective.viewmodel";
import { ObjectiveState } from "../stores/objective.store";

/** Du résultat du chargement (domaine) aux modèles de l'état d'ObjectiveStore. */
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
      why: objective.why,
      dueDate: objective.dueDate ? objective.dueDate.toISOString() : "",
      description: objective.description,
      parentId: objective.parentObjective
    };
  }

  public static fromLoadToObjectiveViewModels(
    input: GetAllObjectiveAndTaskOutput
  ): ObjectiveState {
    return {
      objectives: input.objectives.map(ObjectiveMapper.toObjectiveViewModel),
      tasks: input.tasks.map(ObjectiveMapper.toTaskViewModel),
    };
  }
}
