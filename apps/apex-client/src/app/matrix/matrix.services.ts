import { computed, inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";

@Injectable({
  providedIn: 'root'
})
export class MatrixServices {
  private readonly objectiveStore = inject(ObjectiveStore);

  getTasksEisenhower = computed(() => {
    let tasks : { id: string, title: string, objectiveTitle: string, important: number, urgent: number}[] = [];

    this.objectiveStore.objectives().forEach((objective) => {
      objective.subObjectives.forEach((subObjective) => {
        subObjective.tasks.forEach((task) => {
          tasks.push({
            id: task.id,
            title: task.title,
            objectiveTitle: subObjective.title,
            important: task.importance,
            urgent: task.urgency
          });
        });
      });
    });

    return {
      todo: tasks.filter((task) => task.important >= 3 && task.urgent >= 3),
      schedule: tasks.filter((task) => task.important >= 3 && task.urgent < 3),
      delegate: tasks.filter((task) => task.important < 3 && task.urgent >= 3),
      eliminate: tasks.filter((task) => task.important < 3 && task.urgent < 3)
    }
  });
}
