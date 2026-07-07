import { Result, runWithResult } from "@org/chore";
import { TaskRepository } from "../protocols/task.repository";

export type TaskOutput = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  done: boolean;
};

export class GetAllTaskUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}

  async execute(): Promise<Result<TaskOutput[]>> {
    return runWithResult(
      async () => {
      const tasks = await this.taskRepository.findAll();
      return tasks.map((task) => ({
        id: task.id,
        title: task.title,
        importance: task.importance,
        urgency: task.urgency,
        done: task.done
      }));
      },
      [],
      'Failed to get all tasks'
    );
  }
}
