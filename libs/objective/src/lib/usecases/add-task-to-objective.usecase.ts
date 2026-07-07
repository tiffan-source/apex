import { IdGenerator, Result, runWithResult } from "@org/chore";
import { MainObjectiveRepository, ObjectiveRepository } from "../protocols/objective.repository";
import { Task } from "../models/task";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import { FailToSaveObjectiveError } from "../errors/fail-to-save-objective.error";
import { MainObjective } from "../models/objective";
import { TaskRepository } from "../protocols/task.repository";

export interface AddTaskToObjectiveInput {
  title: string;
  importance: number;
  urgency: number;
}

export interface AddTaskToObjectiveOutput {
  id: string;
  title: string;
  importance: number;
  urgency: number;
}

export class AddTaskToObjectiveUsecase {
  constructor(
    private readonly repository: ObjectiveRepository,
    private readonly taskRepository: TaskRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

  async execute(subObjectiveId: string, task: AddTaskToObjectiveInput): Promise<Result<AddTaskToObjectiveOutput>> {
    return runWithResult<AddTaskToObjectiveOutput>(
      async () => {
        let objective = await this.repository.findById(subObjectiveId);

        if (!objective) {
          throw new ObjectiveNotFoundError(subObjectiveId);
        }

        let taskId = this.idGenerator.generateId();
        let newTask = new Task(taskId, task.title, task.importance, task.urgency);

        objective.addTask(newTask);

        await this.repository.save(objective);
        await this.taskRepository.save(newTask);

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
