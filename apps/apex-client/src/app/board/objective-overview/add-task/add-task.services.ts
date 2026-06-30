import { computed, inject, Injectable, Signal } from "@angular/core";
import { AddTaskToObjectiveUsecase } from "@org/objective";
import { ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";

@Injectable({
  providedIn: 'root'
})
export class AddTaskServices {
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly addTaskUsecase = inject(AddTaskToObjectiveUsecase);

  subObjective = (objectiveId: Signal<string>) => {
    return computed(() => {
      return this.objectiveStore.objectives()
      .find((objective) => objective.id === objectiveId())
      ?.subObjectives.map((subObjective) => {
        return {
          label: subObjective.title,
          value: subObjective.id
        }
      }) ?? [];
    });
  };

  addTask = async (objectiveId: string, subObjectiveId: string, title: string, important: number, urgent: number) => {
    let result = await this.addTaskUsecase.execute(objectiveId, subObjectiveId, {
      title,
      importance: important,
      urgency: urgent
    });

    if (result.success) {
      let data = result.data;
      this.objectiveStore.addTaskToSubObjective(objectiveId, subObjectiveId, {
        id: data.id,
        title: data.title,
        importance: data.importance || important,
        urgency: data.urgency || urgent
      });
    }

  }
}
