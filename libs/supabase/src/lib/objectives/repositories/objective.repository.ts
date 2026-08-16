import { Objective, ObjectiveRepository } from "@org/objective";
import { SupabaseClientDataAccess } from "../../supabase-client";
import { ObjectiveMapper } from "../mapper/objective.mapper";

export class SupabaseObjectiveRepository implements ObjectiveRepository {

  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

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
