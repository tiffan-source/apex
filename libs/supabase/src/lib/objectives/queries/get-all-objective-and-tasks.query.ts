import { GetAllObjectiveAndTaskInput, GetAllObjectiveAndTaskOutput, GetAllObjectiveAndTaskQuery } from "@org/objective"
import { SupabaseClientDataAccess } from "../../supabase-client"
import { ObjectiveMapper } from "../mapper/objective.mapper";

export class SupabaseGetAllObjectiveAndTaskQuery implements GetAllObjectiveAndTaskQuery {
  constructor(
    private readonly supabaseClient: SupabaseClientDataAccess,
  ) {}

  async execute(input: GetAllObjectiveAndTaskInput): Promise<GetAllObjectiveAndTaskOutput>{
    const [objectivesRes, tasksRes] = await Promise.all([
      this.supabaseClient.clientInstance.from("objectives").select("*").eq("user_id", input.ownerId),
      this.supabaseClient.clientInstance.from("tasks").select("*").eq("user_id", input.ownerId),
    ]);

    if (objectivesRes.error) {
      throw new Error(`Erreur récupération objectifs: ${objectivesRes.error.message}`);
    }

    if (tasksRes.error) {
      throw new Error(`Erreur récupération tâches: ${tasksRes.error.message}`);
    }

    // 2. Conversion en tableau de MainObjectiveOutput imbriqués
    return {
      objectives : ObjectiveMapper.toObjectiveOutput(objectivesRes.data),
      tasks: ObjectiveMapper.toTaskOutput(tasksRes.data)
    }
  }
}
