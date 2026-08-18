import { CreateObjectiveOutput, ObjectiveOutput, TaskOutput, GetAllObjectiveAndTaskOutput } from "@org/objective";
import { ObjectiveOverviewViewModel, ObjectiveViewModel, ObjectiveWithProgressViewModel, TaskViewModel, TaskViewModelWithCategory } from "../models/objective.viewmodel";
import { ApexLibsMetier, EisenhowerCategory } from "@org/apex-library"
import { ObjectiveState } from "../stores/objective.store";


export class ObjectiveMapper {

  private static mapCategoryToPrimeNgSeverity(
    category: EisenhowerCategory
  ): 'success' | 'info' | 'warn' | 'danger' {
    switch (category) {
      case EisenhowerCategory.DO:
        return 'danger';
      case EisenhowerCategory.SCHEDULE:
        return 'warn';
      case EisenhowerCategory.DELEGATE:
        return 'info';
      case EisenhowerCategory.DELETE:
        return 'success';
    }
  }

  private static toTaskViewModel(task: TaskOutput): TaskViewModel {
    return {
      id: task.id,
      title: task.title,
      importance: task.importance,
      urgency: task.urgency,
      done: task.done,
      objectiveId: task.objectiveId,
    };
  }

  private static toObjectiveViewModel(objective: ObjectiveOutput): ObjectiveViewModel {
    return {
      id: objective.id,
      title: objective.title,
      why: objective.why,
      dueDate: objective.dueDate ? objective.dueDate.toISOString() : "",
      description: objective.description,
      parentId: objective.parentObjective
    };
  }

  public static fromLoadToObjectiveViewModels(
    input: GetAllObjectiveAndTaskOutput
  ): ObjectiveState {
    return {
      objectives: input.objectives.map(ObjectiveMapper.toObjectiveViewModel),
      tasks: input.tasks.map(ObjectiveMapper.toTaskViewModel),
    };
  }

  private static isATaskObjective(
    task: TaskViewModel,
    objectiveId: string,
    allObjectives: ObjectiveViewModel[]
  ): boolean {
    let currentId: string | null = task.objectiveId;

    while (currentId) {
      if (currentId === objectiveId) {
        return true;
      }

      const parent = allObjectives.find(o => o.id === currentId);
      currentId = parent?.parentId ?? null;
    }

    return false;
  }

  public static toObjectivesWithProgress(
    objectives: ObjectiveViewModel[],
    tasks: TaskViewModel[]
  ): ObjectiveWithProgressViewModel[] {
    return objectives
    .filter((obj) => obj.parentId === null)
    .map((obj) => {
      const objWithTasks = { ...obj, tasks: tasks.filter((t) => ObjectiveMapper.isATaskObjective(t, obj.id, objectives)) };
      return {
        ...objWithTasks,
        totalTasks: objWithTasks.tasks.length,
        doneTasks: objWithTasks.tasks.filter((t) => t.done).length,
        progress: objWithTasks.tasks.length > 0 ? objWithTasks.tasks.filter((t) => t.done).length / objWithTasks.tasks.length : 0,
      };
    });
  }

  public static fromCreateObjectiveOutputToObjectiveViewModel(output: CreateObjectiveOutput): ObjectiveViewModel {
    return {
      id: output.id,
      title: output.title,
      description: output.description || '',
      why: output.why || '',
      dueDate: output.dueDate ? output.dueDate.toISOString() : '',
      parentId: null
    };
  }

  public static fromTaskViewModelToCategorizedTaskViewModel(task: TaskViewModel): TaskViewModelWithCategory {

    const category = ApexLibsMetier.getEisenhowerCategory({
      importance: task.importance,
      urgency: task.urgency,
    });

    return {
      ...task,
      category,
      primNgSeverity: ObjectiveMapper.mapCategoryToPrimeNgSeverity(category),
    };
  }

  public static objectiveOverviewDetail(
    id: string,
    objectives: ObjectiveViewModel[],
    tasks: TaskViewModel[]
  ): ObjectiveOverviewViewModel | undefined {

    const objective = objectives.find(o => o.id === id);
    if (!objective) return undefined;

    const subObjectives = ObjectiveMapper.getAllSubObjectives(id, objectives);
    const allObjectiveIds = [id, ...subObjectives.map(o => o.id)];

    const tasksWithCategory = tasks
      .filter(t => allObjectiveIds.includes(t.objectiveId))
      .map( (t)=>({
        ...ObjectiveMapper.fromTaskViewModelToCategorizedTaskViewModel(t),
        objectiveTitle: objectives.find(o => o.id === t.objectiveId)?.title || 'Objectif inconnu'
      }));

    return {
      id: objective.id,
      title: objective.title,
      why: objective.why,
      description: objective.description,
      dueDate: objective.dueDate,
      tasks: tasksWithCategory,
      subObjectives: subObjectives,
    };
  }

  private static getAllSubObjectives(
    parentId: string,
    allObjectives: ObjectiveViewModel[]
  ): ObjectiveViewModel[] {
    const directChildren = allObjectives.filter(o => o.parentId === parentId);

    return directChildren.flatMap(child => [
      child,
      ...ObjectiveMapper.getAllSubObjectives(child.id, allObjectives),
    ]);
  }
}


