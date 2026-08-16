import { Task } from "@org/objective";
import { Database } from "../../database.types";

type TaskRow = Omit<Database['public']['Tables']['tasks']['Row'], 'created_at' | 'objective_id' | 'user_id'>;

export class TaskMapper {

  static toDomain(task: TaskRow): Task {
    let domainTask = new Task(task.id, task.title, task.importance, task.urgency);

    if (task.description) domainTask.setDescription(task.description);
    if (task.due_date) domainTask.setDueDate(new Date(task.due_date));
    domainTask.setDone(task.done);

    return domainTask;
  }

  static toPersistence(task: Task): TaskRow {
    return {
      id: task.id,
      title: task.title,
      description: task.description ?? null,
      importance: task.importance,
      urgency: task.urgency,
      due_date: task.dueDate ? task.dueDate.toISOString() : null,
      done: task.done
    };
  }

}
