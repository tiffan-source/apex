import { Task } from "../models/task";

export abstract class TaskRepository {
  abstract save(task: Task): Promise<boolean>;
  abstract findAll(): Promise<Task[]>;
  abstract findById(id: string): Promise<Task | null>;
}
