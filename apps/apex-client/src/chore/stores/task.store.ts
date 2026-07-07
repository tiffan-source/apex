import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { TaskOutput } from "@org/objective";

export type TaskViewModel = {
  id: string;
  title: string;
  importance: number;
  urgency: number;
  done: boolean;
};

const initialState = {
  tasks: [] as TaskViewModel[]
};

export const TaskStore = signalStore(
  {providedIn: 'root'},
  withState(initialState),
  withMethods((store) => ({
    addTask: (task: TaskViewModel) => {
      patchState(store, (state) => ({ ...state, tasks: [...state.tasks, task] }));
    },
    setTasks: (tasks: TaskViewModel[]) => {
      patchState(store, () => ({ ...initialState, tasks }));
    },
    setTaskDone: (taskId: string, done: boolean) => {
      patchState(store, (state) => {
        const updatedTasks = state.tasks.map((task) => {
          if (task.id === taskId) {
            return { ...task, done };
          }
          return task;
        });
        return { ...state, tasks: updatedTasks };
      });
    }
  }))
)

export function fromDomainToTaskViewModel(task: TaskOutput): TaskViewModel {
  return {
    id: task.id,
    title: task.title,
    importance: task.importance,
    urgency: task.urgency,
    done: task.done
  };
}
