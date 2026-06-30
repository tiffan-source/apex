import { Task } from "./task";

export class Objective {
  private readonly _id: string;
  private _title: string;
  private _description?: string;
  private _why?: string;
  private _dueDate?: Date;
  private _subObjectives: Objective[] = [];
  private _tasks: Task[] = [];


  constructor(id: string, title: string) {
    this._id = id;
    this._title = title;
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get description(): string | undefined {
    return this._description;
  }

  get why(): string | undefined {
    return this._why;
  }

  get dueDate(): Date | undefined {
    return this._dueDate;
  }

  get subObjectives(): Objective[] {
    return this._subObjectives;
  }

  get tasks(): Task[] {
    return this._tasks;
  }

  setDescription(description: string): void {
    this._description = description;
  }

  setWhy(why: string): void {
    this._why = why;
  }

  setDueDate(dueDate: Date): void {
    this._dueDate = dueDate;
  }

  addSubObjective(subObjective: Objective): void {
    this._subObjectives.push(subObjective);
  }

  addTask(task: Task): void {
    this._tasks.push(task);
  }
}
