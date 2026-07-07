import { TodoBase } from "./todo-base";

export class Task extends TodoBase {

  private _importance: number;
  private _urgency: number;

  constructor(id: string, title: string, importance: number, urgency: number) {
    super(id, title);
    this._importance = importance;
    this._urgency = urgency;
  }

  get importance(): number {
    return this._importance;
  }

  get urgency(): number {
    return this._urgency;
  }

  setImportance(importance: number) {
    this._importance = importance;
    return this;
  }

  setUrgency(urgency: number) {
    this._urgency = urgency;
    return this;
  }
}
