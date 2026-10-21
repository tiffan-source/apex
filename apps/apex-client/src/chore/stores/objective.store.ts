import { effect, inject } from "@angular/core";
import { signalStore, withHooks, withState } from "@ngrx/signals";
import { SessionStore } from "./session.store";
import { ObjectiveViewModel, TaskViewModel } from "../models/objective.viewmodel";
import { withCreateObjective } from "./features/with-create-objective";
import { withObjectiveQuery } from "./features/with-objective-query";
import { withObjectivesLoaded } from "./features/with-objectives-loaded";
import { withRequestStatus } from "./utils/loading-feature";
import { withCreateSubObjective } from "./features/with-create-sub-objective";
import { withAddTaskToObjective } from "./features/with-add-task-to-objective";
import { withUpdateTaskDone } from "./features/with-update-task-done";
import { withEditObjective } from "./features/with-edit-objective";
import { withTaskEdit } from "./features/with-task-edit";
import { withObjectiveViews } from "./features/with-objective-views";
import { withMoveTaskToQuadrant } from "./features/with-move-task-to-quadrant";

export type ObjectiveState = {
  objectives: ObjectiveViewModel[];
  tasks: TaskViewModel[]
};

const initialState: ObjectiveState = {
  objectives: [],
  tasks: []
};

/*
 * signalStore() n'a de surcharges typées que jusqu'à 15 fonctionnalités : au-delà, tout le type du store
 * tombe (TS2769). Une nouvelle fonctionnalité qui ne tiendrait plus se regroupe avec d'autres dans un
 * signalStoreFeature.
 */
export const ObjectiveStore = signalStore(
  withState<ObjectiveState>(initialState),
  withRequestStatus(),
  withObjectivesLoaded(),
  withObjectiveQuery(),
  withCreateObjective(),
  withCreateSubObjective(),
  withAddTaskToObjective(),
  withEditObjective(),
  withUpdateTaskDone(),
  withTaskEdit(),
  withObjectiveViews(),
  withMoveTaskToQuadrant(),
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
