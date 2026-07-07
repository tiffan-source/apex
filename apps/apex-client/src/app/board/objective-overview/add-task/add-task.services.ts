import { computed, inject, Injectable, Signal } from "@angular/core";
import { AddTaskToObjectiveUsecase } from "@org/objective";
import { SubObjectiveRelatedToObjectiveService } from "apps/apex-client/src/chore/services/sub-objective-related-to-objective.service";
import { ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";
import { TaskStore } from "apps/apex-client/src/chore/stores/task.store";

@Injectable({
  providedIn: 'root'
})
export class AddTaskServices {
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);
  private readonly addTaskUsecase = inject(AddTaskToObjectiveUsecase);
  private readonly subObjectiveRelatedToObjectiveService = inject(SubObjectiveRelatedToObjectiveService);

  subObjective = (objectiveId: Signal<string>) => {
    return computed(() => {
      return this.subObjectiveRelatedToObjectiveService.fillSubObjectiveFromObjectives(objectiveId()).map((subObjective) => {
        return {
          value: subObjective.id,
          label: subObjective.title,
        }
      })
    })
  };

  addTask = async (subObjectiveId: string, title: string, important: number, urgent: number) => {
    let result = await this.addTaskUsecase.execute(subObjectiveId, {
      title,
      importance: important,
      urgency: urgent
    });

    if (result.success) {
      let data = result.data;
      this.objectiveStore.addTaskToSubObjective(subObjectiveId, data.id);
      this.taskStore.addTask({
        id: data.id,
        title: data.title,
        importance: data.importance,
        urgency: data.urgency,
        done: false
      });
    }

  }
}
