// objective.mapper.ts
import { Objective, ObjectiveOutput, Task, TaskOutput } from "@org/objective";
import { Database } from "../../database.types";

type ObjectiveRow = Omit<Database['public']['Tables']['objectives']['Row'], 'created_at'>;
type TaskRow = Omit<Database['public']['Tables']['tasks']['Row'], 'created_at'>;

export class ObjectiveMapper {
  public static flatten(objective: Objective, userId: string): { objectives: ObjectiveRow[]; tasks: TaskRow[] } {
    const objectives: ObjectiveRow[] = [];
    const tasks: TaskRow[] = [];

    // 1. Extraction de l'objectif courant
    objectives.push({
      id: objective.id,
      user_id: userId,
      title: objective.title,
      description: objective.description || null,
      done: objective.done,
      due_date: objective.dueDate ? objective.dueDate.toISOString() : null,
      why: objective.why || null,
      parent_id: objective.parentId || null,
    });

    // 2. Extraction de ses tâches directes
    for (const task of objective.tasks) {
      tasks.push({
        id: task.id,
        user_id: userId,
        title: task.title,
        description: task.description || null,
        done: task.done, // Obligatoire
        due_date: task.dueDate ? task.dueDate.toISOString() : null,
        importance: task.importance,
        urgency: task.urgency,
        objective_id: objective.id,
      });
    }

    // 3. Parcours récursif des sous-objectifs
    for (const subObj of objective.subObjectives) {
      const childResult = this.flatten(subObj, userId);
      objectives.push(...childResult.objectives);
      tasks.push(...childResult.tasks);
    }

    return { objectives, tasks };
  }

  private static fromRowToObjective(row: ObjectiveRow): Objective {
    const objective = new Objective(row.id, row.title);
    if (row.description) objective.setDescription(row.description);
    if (row.due_date) objective.setDueDate(new Date(row.due_date));
    if (row.why) objective.setWhy(row.why);
    if (row.parent_id) objective.setParentId(row.parent_id);
    objective.setDone(row.done);
    return objective;
  }

  private static fromRowToTask(row: TaskRow): Task {
    const task = new Task(row.id, row.title, row.importance, row.urgency);
    if (row.description) task.setDescription(row.description);
    if (row.due_date) task.setDueDate(new Date(row.due_date));
    task.setDone(row.done);
    return task;
  }

  public static toDomain(flatObjectives: ObjectiveRow[], flatTasks: TaskRow[], targetRootId: string): Objective | null {
    if (flatObjectives.length === 0) return null;

    const objectiveMap = new Map<string, Objective>();

    // 1. Instanciation de toutes les entités Objective
    for (const row of flatObjectives) {
      const obj = this.fromRowToObjective(row);

      objectiveMap.set(row.id, obj);
    }

    // 2. Instanciation des Task et raccordement à leurs Objective parents
    for (const row of flatTasks) {
      const task = this.fromRowToTask(row);

      const parentObjective = objectiveMap.get(row.objective_id);
      if (parentObjective) {
        parentObjective.addTask(task);
      }
    }

    // 3. Emboîtement récursif des sous-objectifs
    for (const row of flatObjectives) {
      if (row.parent_id && objectiveMap.has(row.parent_id)) {
        const parent = objectiveMap.get(row.parent_id)!;
        const child = objectiveMap.get(row.id)!;
        parent.addSubObjective(child);
      }
    }

    // 4. Retourne l'instance de l'objectif racine demandé avec tout son arbre rattaché
    return objectiveMap.get(targetRootId) ?? null;
  }

  public static toObjectiveOutput(
    flatObjectives: ObjectiveRow[]
  ): ObjectiveOutput[] {
    return flatObjectives.map(obj => ({
      dueDate : obj.due_date ? new Date(obj.due_date) : null,
      parentObjective: obj.parent_id,
      description : obj.description ?? "",
      id: obj.id,
      title: obj.title,
      why: obj.why ?? ""
    }))
  }

  public static toTaskOutput(
    flatTask: TaskRow[]
  ): TaskOutput[] {
    return flatTask.map(task => ({
      done: task.done,
      id: task.id,
      importance: task.importance,
      urgency: task.urgency,
      title: task.title,
      objectiveId: task.objective_id
    }))
  }
}
