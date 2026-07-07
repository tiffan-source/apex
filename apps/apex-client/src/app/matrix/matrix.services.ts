import { computed, inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";
import { TaskStore } from "../../chore/stores/task.store";

@Injectable({
  providedIn: 'root'
})
export class MatrixServices {
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);

  getTasksEisenhower = computed(() => {
    let tasks = this.taskStore.tasks();
    let result = tasks.map((task) => ({
      ...task,
      objectiveTitle: this.objectiveStore.subObjectives().find((objective) => objective.id === task.id)?.title ?? ''
    }))

    return {
      todo: result.filter((task) => task.importance >= 3 && task.urgency >= 3),
      schedule: result.filter((task) => task.importance >= 3 && task.urgency < 3),
      delegate: result.filter((task) => task.importance < 3 && task.urgency >= 3),
      eliminate: result.filter((task) => task.importance < 3 && task.urgency < 3)
    }
  });
}
