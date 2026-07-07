import { Result, runWithResult } from "@org/chore";
import { TaskNotFoundError } from "../errors/task-not-found.error";
import { TaskRepository } from "../protocols/task.repository";
import { FailToSaveTaskError } from "../errors/fail-to-save-task.error";

type UpdateDoneStatusOfTaskOutput = {
  id: string;
  title: string;
  done: boolean;
};

export class UpdateDoneStatusOfTaskUsecase {

  constructor(
    private readonly repository: TaskRepository,
  ) {}

  async execute(taskId: string, done: boolean): Promise<Result<UpdateDoneStatusOfTaskOutput>> {
    return runWithResult<UpdateDoneStatusOfTaskOutput>(
      async () => {
        let task = await this.repository.findById(taskId);

        if (!task) {
          throw new TaskNotFoundError(taskId);
        }

        task.setDone(done);

        let result = await this.repository.save(task);

        if (!result) {
          throw new FailToSaveTaskError(taskId);
        }

        return {
          id: task.id,
          title: task.title,
          done: task.done
        };
      },
      [TaskNotFoundError, FailToSaveTaskError],
      'Failed to update task status'
    );
  }
}
