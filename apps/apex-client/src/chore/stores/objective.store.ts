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
import { withDeleteTask } from "./features/with-delete-task";
import { withDeleteObjective } from "./features/with-delete-objective";
import { withObjectiveViews } from "./features/with-objective-views";
import { withOptimisticWrites } from "./utils/optimistic-writes";

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
  withOptimisticWrites(),
  withCreateObjective(),
  withCreateSubObjective(),
  withAddTaskToObjective(),
  withEditObjective(),
  withUpdateTaskDone(),
  withTaskEdit(),
  withDeleteTask(),
  withDeleteObjective(),
  withObjectiveViews(),
  withHooks((store, session = inject(SessionStore)) =>({
    onInit() {
      // Les objectifs de la personne connectée (l'API la reconnaît à son jeton), rechargés quand elle change.
      effect(() => {
        const userId = session.currentUserId();
        if (userId) {
          store.loadObjectives();
        } else {
          store.clearObjectives();
        }
      });
    },
  }))
);
