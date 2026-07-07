import { inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../stores/objective.store";
import { TaskStore, TaskViewModel } from "../stores/task.store";

@Injectable({ providedIn: 'root' })
export class TaskRelatedToObjectiveService {
  private readonly objectivesStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);


  public fillTaskFromObjectives = (objectivesId: string): TaskViewModel[] => {
    let result: TaskViewModel[] = [];

    let objective = [...this.objectivesStore.objectives(), ...this.objectivesStore.subObjectives()].find((objective) => objective.id === objectivesId);

    if (!objective) {
      return result;
    }

    objective.tasks.forEach((taskId) => {
      let task = this.taskStore.tasks().find((task) => task.id === taskId);
      if (task) {
        result.push(task);
      }
    });

    return [...result, ...objective.subObjectives.flatMap((subObjectiveId) => this.fillTaskFromObjectives(subObjectiveId))];
  }
}
