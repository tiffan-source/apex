import { Result, runWithResult } from "@org/chore";
import { TaskNotFoundError } from "../errors/task-not-found.error";
import { TaskRepository } from "../protocols/task.repository";
import { FailToSaveTaskError } from "../errors/fail-to-save-task.error";

type UpdateDoneStatusOfTaskInput = {
  taskId: string;
  done: boolean;
};

type UpdateDoneStatusOfTaskOutput = {
  id: string;
  title: string;
  done: boolean;
};

export class UpdateDoneStatusOfTaskUsecase {

  constructor(
    private readonly repository: TaskRepository,
  ) {}

  async execute(input: UpdateDoneStatusOfTaskInput): Promise<Result<UpdateDoneStatusOfTaskOutput>> {
    return runWithResult<UpdateDoneStatusOfTaskOutput>(
      async () => {
        let task = await this.repository.findById(input.taskId);

        if (!task) {
          throw new TaskNotFoundError(input.taskId);
        }

        task.setDone(input.done);

        let result = await this.repository.update(task);

        if (!result) {
          throw new FailToSaveTaskError(input.taskId);
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
