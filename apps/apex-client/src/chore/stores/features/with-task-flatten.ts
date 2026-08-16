import { signalStoreFeature, type, withComputed } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { TaskViewModelWithCategory } from "../../models/objective.viewmodel";
import { computed } from "@angular/core";
import { ObjectiveMapper } from "../../mapper/objective.mapper";

export function withTask() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({ tasks }) => ({
      allTasksWithCategoryAndObjective: computed<TaskViewModelWithCategory[]>(() => tasks().map(ObjectiveMapper.fromTaskViewModelToCategorizedTaskViewModel)),
    }))
  );
}
