import { patchState, signalStore, withMethods, withState } from "@ngrx/signals";

export type ObjectieViewModel = {
  id: string;
  title: string;
  description: string;
  why: string;
  dueDate: Date | null;
  subObjectives: ObjectieViewModel[];
  tasks: {
    id: string;
    title: string;
    importance: number;
    urgency: number;
  }[];
};

const initialState = {
  objectives: [] as ObjectieViewModel[]
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
              subObjectives: [...objective.subObjectives, subObjective],
            };
          }
          return objective;
        });
        return { ...state, objectives: updatedObjectives };
      });
    },
    addTaskToSubObjective: (objectiveId: string, subObjectiveId: string, task: { id: string; title: string; importance: number; urgency: number }) => {
      patchState(store, (state) => {
        const updatedObjectives = state.objectives.map((objective) => {
          if (objective.id === objectiveId) {
            const updatedSubObjectives = objective.subObjectives.map((subObjective) => {
              if (subObjective.id === subObjectiveId) {
                return {
                  ...subObjective,
                  tasks: [...subObjective.tasks, task],
                };
              }
              return subObjective;
            });
            return { ...objective, subObjectives: updatedSubObjectives };
          }
          return objective;
        });
        return { ...state, objectives: updatedObjectives };
      });
    },
    setObjectives: (objectives: ObjectieViewModel[]) => {
      patchState(store, () => ({ ...initialState, objectives }));
    }
  }))
)
