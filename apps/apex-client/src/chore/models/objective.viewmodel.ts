export type ObjectiveViewModel = {
  id: string;
  title: string;
  why: string;
  description: string;
  dueDate: string;
  parentId: string | null;
};

export type TaskViewModel = {
  id: string;
  title: string;
  importance: number;
  done: boolean;
  urgency: number;
  objectiveId: string;
};
