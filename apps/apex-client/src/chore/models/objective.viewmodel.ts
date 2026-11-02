export type ObjectiveViewModel = {
  id: string;
  title: string;
  why: string;
  description: string;
  dueDate: string;
  parentId: string | null;
  /** Fait ou non fait, tel que l'API le dit. */
  done: boolean;
};

export type TaskViewModel = {
  id: string;
  title: string;
  importance: number;
  done: boolean;
  urgency: number;
  objectiveId: string;
};
