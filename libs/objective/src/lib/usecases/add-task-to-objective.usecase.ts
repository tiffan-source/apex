import { IdGenerator, Result, runWithResult } from "@org/chore";
import { ObjectiveRepository } from "../protocols/objective.repository";
import { Task } from "../models/task";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import { FailToSaveObjectiveError } from "../errors/fail-to-save-objective.error";

export interface AddTaskToObjectiveInput {
  title: string;
  importance: number;
  urgency: number;
}

export interface AddTaskToObjectiveOutput {
  id: string;
  title: string;
  importance?: number;
  urgency?: number;
}

export class AddTaskToObjectiveUsecase {
  constructor(
    private readonly repository: ObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(objectiveId: string, subObjectiveId: string, task: AddTaskToObjectiveInput): Promise<Result<AddTaskToObjectiveOutput>> {
    return runWithResult<AddTaskToObjectiveOutput>(
      async () => {
        let objective = await this.repository.findById(objectiveId);

        if (!objective) {
          throw new ObjectiveNotFoundError(objectiveId);
        }

        let taskId = this.idGenerator.generateId();
        let newTask = new Task(taskId, task.title);

        newTask.setImportance(task.importance);
        newTask.setUrgency(task.urgency);

        objective.subObjectives.forEach((subObjective) => {
          if (subObjective.id === subObjectiveId) {
            subObjective.addTask(newTask);
          }
        });

        let result = await this.repository.save(objective);

        if (!result) {
          throw new FailToSaveObjectiveError(objectiveId);
        }

        return {
          id: newTask.id,
          title: newTask.title,
          importance: newTask.importance,
          urgency: newTask.urgency
        };
      },
      [ObjectiveNotFoundError, FailToSaveObjectiveError],
      'Failed to add task to objective'
    );
  }
}
