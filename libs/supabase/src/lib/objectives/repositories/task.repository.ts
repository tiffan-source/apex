import { Task, TaskRepository } from "@org/objective";
import { TaskMapper } from "../mapper/task.mapper";
import { SupabaseClientDataAccess } from "../../supabase-client";

export class SupabaseTaskRepository implements TaskRepository {

  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  async getAllUserTasks(userId: string): Promise<Task[]> {
    let { data: tasksData, error } = await this.supabaseClient.clientInstance
      .from("tasks")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      throw new Error(`Erreur récupération tâches: ${error.message}`);
    }

    if (!tasksData) {
      return [];
    }

    return tasksData.map((taskData) => TaskMapper.toDomain(taskData));
  }

  async findById(taskId: string): Promise<Task | null> {
    let { data: taskData, error } = await this.supabaseClient.clientInstance
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (error) {
      throw new Error(`Erreur récupération tâche: ${error.message}`);
    }

    if (!taskData) {
      return null;
    }

    return TaskMapper.toDomain(taskData);

  }

  async update(task: Task): Promise<boolean> {
    let { error } = await this.supabaseClient.clientInstance
      .from("tasks")
      .update(TaskMapper.toPersistence(task))
      .eq("id", task.id);

    if (error) {
      throw new Error(`Erreur sauvegarde tâche: ${error.message}`);
    }

    return true;
  }

}
