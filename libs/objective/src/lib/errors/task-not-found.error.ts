import { CoreError } from "@org/chore";

export class TaskNotFoundError extends CoreError {
  constructor(taskId: string) {
    super(`TASK_NOT_FOUND`, `Task with ID ${taskId} not found`, { taskId });
  }
}
