import { Task } from "../models/task";

export abstract class TaskRepository {

  abstract findById(taskId: string): Promise<Task | null>;

  abstract update(task: Task): Promise<boolean>;

  abstract getAllUserTasks(userId: string): Promise<Task[]>;

}
