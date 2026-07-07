import { computed, inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";
import { TaskStore } from "../../chore/stores/task.store";

@Injectable({
  providedIn: 'root'
})
export class DailyServices {
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);

  mostimportantTaskOftheDay = computed(() => {
    let tasks = this.taskStore.tasks().map((task) => ({
      ...task,
      objectiveTitle: this.objectiveStore.subObjectives().find((objective) => objective.id === task.id)?.title ?? ''
    }));

    return tasks.filter((task) => task.importance >= 3 && task.urgency >= 3).map((task) => {
      return {
        id: task.id,
        title: task.title,
        objectiveTitle: task.objectiveTitle
      }
    });
  });
}
