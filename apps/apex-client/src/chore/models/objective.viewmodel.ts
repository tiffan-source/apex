import { EisenhowerCategory } from "@org/apex-library";

export type ObjectiveWithProgressViewModel = ObjectiveViewModel & {
  totalTasks: number; // tâches de cet objectif + tous ses sous-objectifs
  doneTasks: number;
  progress: number; // 0 à 1, dérivé de doneTasks / totalTasks
};

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

export type TaskViewModelWithCategory = TaskViewModel & {
  category: EisenhowerCategory;
  primNgSeverity: 'success' | 'info' | 'warn' | 'danger';
};

export type TaskViewModelWithCategoryAndObjectiveTitle = TaskViewModelWithCategory & {
  objectiveTitle: string;
};

export type ObjectiveOverviewViewModel = {
  id: string;
  title: string;
  why: string;
  description: string;
  dueDate: string;
  tasks: TaskViewModelWithCategoryAndObjectiveTitle[];
  subObjectives: ObjectiveViewModel[];
}
