import { Task } from "./task";
import { TodoBase } from "./todo-base";

export class Objective extends TodoBase {
  private _why?: string;
  private _tasks: Task[] = [];
  private _subObjectives: Objective[] = [];

  // Si on veut garder la trace du parent dans le domaine pour faciliter l'infra
  private _parentId?: string;

  get why(): string | undefined {
    return this._why;
  }

  setWhy(why: string): void {
    this._why = why;
  }

  get tasks(): Task[] {
    return this._tasks;
  }

  addTask(task: Task): void {
    this._tasks.push(task);
  }

  removeTask(taskId: string): void {
    this._tasks = this._tasks.filter((task) => task.id !== taskId);
  }

  getTaskById(taskId: string): Task | undefined {
    return this._tasks.find((task) => task.id === taskId);
  }

  get subObjectives(): Objective[] {
    return this._subObjectives;
  }

  addSubObjective(subObjective: Objective): void {
    this._subObjectives.push(subObjective);
    subObjective.setParentId(this.id);
  }

  // Règle métier : c'est un objectif principal s'il n'a pas de parent
  get isMainObjective(): boolean {
    return !this._parentId;
  }

  setParentId(parentId: string): void {
    this._parentId = parentId;
  }

  get parentId(): string | undefined {
    return this._parentId;
  }
}
