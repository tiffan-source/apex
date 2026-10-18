import { Objective } from "../models/objective";
import { ObjectiveRepository } from "../protocols/objective.repository";

type TaskOutput = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  done: boolean;
};

export type ObjectiveTreeOutput = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date | null;
  tasks: TaskOutput[];
  subObjectives: ObjectiveTreeOutput[];
};

export class ObjectiveInternalService {

  constructor(
    private readonly objectiveRepository: ObjectiveRepository,
  ) {}

  async getObjectiveTree(objectiveId: string): Promise<ObjectiveTreeOutput | null> {
    try {
      let objective = await this.objectiveRepository.findById(objectiveId);

      if (!objective) {
        return null;
      }

      return this.buildTree(objective);
    } catch (error) {
      console.error("Error occurred while retrieving objective tree:", error);
      return null;
    }
  }

  private buildTree(objective: Objective): ObjectiveTreeOutput {
    return {
      id: objective.id,
      title: objective.title,
      description: objective.description,
      why: objective.why,
      dueDate: objective.dueDate,
      tasks: objective.tasks.map(task => ({
        id: task.id,
        title: task.title,
        importance: task.importance,
        urgency: task.urgency,
        done: task.done
      })),
      subObjectives: objective.subObjectives.map(subObj => this.buildTree(subObj))
    };
  }
}
