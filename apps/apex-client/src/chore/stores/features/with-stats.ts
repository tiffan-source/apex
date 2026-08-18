import { signalStoreFeature, type, withComputed } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { computed } from "@angular/core";

export function withStats() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({objectives, tasks}) => ({
      totalObjectives: computed(() => objectives().length),
      totalTaskDone: computed(() => tasks().filter(task => task.done).length),
      totalUrgentTask: computed(() => tasks().filter(task => task.urgency >= 3).length),
    }))
  )
}
