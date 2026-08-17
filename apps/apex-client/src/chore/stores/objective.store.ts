import { effect, inject } from "@angular/core";
import { signalStore, withHooks, withState } from "@ngrx/signals";
import { SessionStore } from "./session.store";
import { ObjectiveViewModel, TaskViewModel } from "../models/objective.viewmodel";
import { withCreateObjective } from "./features/with-create-objective";
import { withObjectiveQuery } from "./features/with-objective-query";
import { withTask } from "./features/with-task-flatten";
import { withRequestStatus } from "./utils/loading-feature";
import { withCreateSubObjective } from "./features/with-create-sub-objective";
import { withAddTaskToObjective } from "./features/with-add-task-to-objective";
import { withTaskEisenhowerSeparate } from "./features/with-task-eisenhower-separate";
import { withUpdateTaskDone } from "./features/with-update-task-done";
import { withEditObjective } from "./features/with-edit-objective";

export type ObjectiveState = {
  objectives: ObjectiveViewModel[];
  tasks: TaskViewModel[]
};

const initialState: ObjectiveState = {
  objectives: [],
  tasks: []
};

export const ObjectiveStore = signalStore(
  withState<ObjectiveState>(initialState),
  withRequestStatus(),
  withObjectiveQuery(),
  withTask(),
  withCreateObjective(),
  withCreateSubObjective(),
  withAddTaskToObjective(),
  withTaskEisenhowerSeparate(),
  withEditObjective(),
  withUpdateTaskDone(),
  withHooks((store, session = inject(SessionStore)) =>({
    onInit() {
      effect(() => {
        const userId = session.currentUserId();
        if (userId) {
          store.loadObjectives({ ownerId: userId });
        } else {
          store.clearObjectives();
        }
      });
    },
  }))
);
