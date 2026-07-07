import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";
import { MainObjectiveOutput, SubObjectiveOutput } from "@org/objective";

export type ObjectieViewModel = {
  id: string;
  title: string;
  description: string;
  why: string;
  dueDate: Date | null;
  subObjectives: string[];
  tasks: string[];
};

const initialState = {
  objectives: [] as ObjectieViewModel[],
  subObjectives: [] as ObjectieViewModel[]
};

export const ObjectiveStore = signalStore(
  {providedIn: 'root'},
  withState(initialState),
  withMethods((store) => ({
    addObjective: (objective: ObjectieViewModel) => {
      patchState(store, (state) => ({ ...state, objectives: [...state.objectives, objective] }));
    },
    addSubObjective: (objectiveId: string, subObjective: ObjectieViewModel) => {
      patchState(store, (state) => {
        const updatedObjectives = state.objectives.map((objective) => {
          if (objective.id === objectiveId) {
            return {
              ...objective,
              subObjectives: [...objective.subObjectives, subObjective.id],
            };
          }
          return objective;
        });
        return { ...state, objectives: updatedObjectives, subObjectives: [...state.subObjectives, subObjective] };
      });
    },
    addTaskToSubObjective: (subObjectiveId: string, taskId: string) => {
      patchState(store, (state) => {
        const updatedObjectives = state.subObjectives.map((objective) => {
          if (objective.id === subObjectiveId) {
            return {
              ...objective,
              tasks: [...objective.tasks, taskId],
            };
          }
          return objective;
        });
        return { ...state, subObjectives: updatedObjectives };
      });
    },
    setObjectives: (objectives: ObjectieViewModel[]) => {
      patchState(store, (state) => ({ ...state, objectives }));
    },
    setSubObjectives: (subObjectives: ObjectieViewModel[]) => {
      patchState(store, (state) => ({ ...state, subObjectives }));
    }
  }))
)

export function fromMainObjectiveDomainToObjectiveViewModel(objective: MainObjectiveOutput ): ObjectieViewModel {
  return {
    id: objective.id,
    title: objective.title,
    description: objective.description || '',
    why: objective.why || '',
    dueDate: objective.dueDate || null,
    subObjectives: objective.subObjectives || [],
    tasks: []
  };
}

export function fromSubObjectiveDomainToObjectiveViewModel(subObjective: SubObjectiveOutput): ObjectieViewModel {
  return {
    id: subObjective.id,
    title: subObjective.title,
    description: subObjective.description || '',
    why: '',
    dueDate: subObjective.dueDate || null,
    subObjectives: subObjective.subObjectives || [],
    tasks: subObjective.tasks || []
  };
}
