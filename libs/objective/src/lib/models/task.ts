export class Task {
  private readonly _id: string;
  private _title: string;
  private _importance?: number;
  private _urgency?: number;

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

  get importance(): number | undefined {
    return this._importance;
  }

  get urgency(): number | undefined {
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
