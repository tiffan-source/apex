import { Result, runWithResult } from "@org/chore";
import { ObjectiveRepository } from "../protocols/objective.repository";
import { TaskNotFoundError } from "../errors/task-not-found.error";
import { FailToSaveTaskError } from "../errors/fail-to-save-task.error";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import { Task } from "../models/task";

export interface EditMyTaskInput {
  task: {
    id: string;
    title: string;
    objectiveId: string;
    importance: number;
    urgency: number;
  };
  ownerId: string;
}

export interface EditMyTaskOutput {
  id: string;
  title: string;
  objectiveId: string;
  importance: number;
  urgency: number;
}

export class EditMyTaskUsecase {
  constructor(
    private readonly objectiveRepository: ObjectiveRepository,
  ) {}

  async execute(input: EditMyTaskInput): Promise<Result<EditMyTaskOutput>> {
    return runWithResult<EditMyTaskOutput>(
      async () => {
        let { id, title, objectiveId, importance, urgency } = input.task;


        let oldObjective = await this.objectiveRepository.findObjectiveWithASpecificTaskId(id);

        if(!oldObjective) {
          throw new ObjectiveNotFoundError(id);
        }

        let task = oldObjective.getTaskById(id) as Task;

        task.setTitle(title);
        task.setImportance(importance);
        task.setUrgency(urgency);

        if (oldObjective.id !== objectiveId) {
          let newObjective = await this.objectiveRepository.findById(objectiveId);

          if(!newObjective) {
            throw new ObjectiveNotFoundError(objectiveId);
          }

          oldObjective.removeTask(id);
          newObjective.addTask(task);

          await this.objectiveRepository.save(oldObjective, input.ownerId);
          await this.objectiveRepository.save(newObjective, input.ownerId);
        } else {
          await this.objectiveRepository.save(oldObjective, input.ownerId);
        }


        return {
          id: task.id,
          title: task.title,
          objectiveId: objectiveId,
          importance: task.importance,
          urgency: task.urgency,
        };
      },
      [TaskNotFoundError, FailToSaveTaskError],
      "Failed to edit task"
    );
  }
}
