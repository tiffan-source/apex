import { Task } from "./task";
import { TodoBase } from "./todo-base";

export class Objective extends TodoBase {
  private _tasks: Task[] = [];
  private _subObjectives: Objective[] = [];

  get tasks(): Task[] {
    return this._tasks;
  }

  addTask(task: Task): void {
    this._tasks.push(task);
  }

  addSubObjective(subObjective: Objective): void {
    this._subObjectives.push(subObjective);
  }

  get subObjectives(): Objective[] {
    return this._subObjectives;
  }
}

export class MainObjective extends TodoBase {
  private _why?: string;
  private _subObjectives: Objective[] = [];

  get why(): string | undefined {
    return this._why;
  }

  get subObjectives(): Objective[] {
    return this._subObjectives;
  }

  setWhy(why: string): void {
    this._why = why;
  }

  addSubObjective(subObjective: Objective): void {
    this._subObjectives.push(subObjective);
  }
}
