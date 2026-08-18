import { Objective, ObjectiveRepository, Task } from "@org/objective";
import { SupabaseClientDataAccess } from "../../supabase-client";
import { ObjectiveMapper } from "../mapper/objective.mapper";

export class SupabaseObjectiveRepository implements ObjectiveRepository {

  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  async findObjectiveWithASpecificTaskId(taskId: string): Promise<Objective | null> {
    // 1. Récupération de l'objectif contenant la tâche spécifique
    const { data, error } = await this.supabaseClient.clientInstance
      .from('tasks')
      .select(`
        objectives (
          *,
          tasks (*)
        )
      `)
      .eq('id', taskId)
      .maybeSingle();

    if (error) {
      throw new Error(`Erreur récupération objectif avec tâche spécifique: ${error.message}`);
    }
  
    if (!data || !data.objectives) {
      return null;
    }

    // 2. Reconstitution de l'objectif à partir des données récupérées
    const objectiveData = data.objectives;
    const taskData = data.objectives.tasks;

    let objective = new Objective(objectiveData.id, objectiveData.title);
    if (objectiveData.description) objective.setDescription(objectiveData.description);
    if (objectiveData.due_date) objective.setDueDate(new Date(objectiveData.due_date));
    if (objectiveData.why) objective.setWhy(objectiveData.why);
    if (objectiveData.parent_id) objective.setParentId(objectiveData.parent_id);
    objective.setDone(objectiveData.done);

    for (const task of taskData) {
      let domainTask = new Task(task.id, task.title, task.importance, task.urgency);
      objective.addTask(domainTask);
    }

    return objective;
  }

  async save(
    objective: Objective,
    ownerId: string,
  ): Promise<boolean>{
    try {
      const { objectives, tasks } = ObjectiveMapper.flatten(objective, ownerId);


      // 2. Sauvegarde des objectifs (dans l'ordre parent -> enfants)
      const { error: objError } = await this.supabaseClient.clientInstance
        .from("objectives")
        .upsert(objectives, { onConflict: "id" });

      if (objError) {
        console.error("Erreur lors de la sauvegarde des objectifs:", objError);
        return false;
      }

      // 3. Sauvegarde des tâches (si l'objectif en contient)
      if (tasks.length > 0) {
        const { error: taskError } = await this.supabaseClient.clientInstance
          .from("tasks")
          .upsert(tasks, { onConflict: "id" });

        if (taskError) {
          console.error("Erreur lors de la sauvegarde des tâches:", taskError);
          return false;
        }
      }
      return true;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'objectif:", error);
      return false;
    }
  }

async findById(id: string): Promise<Objective | null> {
    // 1. Récupération récursive de l'objectif et de tous ses sous-objectifs
    const { data: flatObjectives, error: objError } = await this.supabaseClient.clientInstance
      .rpc("get_objective_subtree", { p_id: id });

    if (objError) {
      throw new Error(`Erreur récupération sous-arbre: ${objError.message}`);
    }

    if (!flatObjectives || flatObjectives.length === 0) {
      return null;
    }

    // 2. Extraction des identifiants d'objectifs pour charger toutes les tâches associées en 1 seule requête
    const objectiveIds = flatObjectives.map((obj) => obj.id);

    const { data: flatTasks, error: taskError } = await this.supabaseClient.clientInstance
      .from("tasks")
      .select("*")
      .in("objective_id", objectiveIds);

    if (taskError) {
      throw new Error(`Erreur récupération tâches: ${taskError.message}`);
    }

    // 3. Reconstitution des classes Domaine et de l'arborescence
    return ObjectiveMapper.toDomain(flatObjectives, flatTasks ?? [], id);
  }

}
