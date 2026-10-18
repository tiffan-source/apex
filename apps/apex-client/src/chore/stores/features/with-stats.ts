import { signalStoreFeature, type, withComputed } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { computed } from "@angular/core";

export function withStats() {
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({objectives, tasks}) => ({
      // Seuls les objectifs racines comptent : les sous-objectifs ne sont pas affichés sur le tableau de bord
      totalObjectives: computed(() => objectives().filter(objective => objective.parentId === null).length),
      totalTaskDone: computed(() => tasks().filter(task => task.done).length),
      totalUrgentTask: computed(() => tasks().filter(task => task.urgency >= 3).length),
    }))
  )
}
