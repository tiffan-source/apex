import { computed, inject, Injectable } from "@angular/core";
import { ObjectieViewModel, ObjectiveStore } from "../../chore/stores/objective.store";
import { Router } from "@angular/router";
import { TaskStore, TaskViewModel } from "../../chore/stores/task.store";
import { TaskRelatedToObjectiveService } from "../../chore/services/task-related-to-objective.service";

@Injectable({ providedIn: 'root' })
export class BoardServices {
  private readonly objectivesStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);
  private readonly router = inject(Router);

  private readonly taskRelatedToObjectiveService = inject(TaskRelatedToObjectiveService);

  getAllObjectives = computed(() => {
    let data = this.objectivesStore.objectives();

    return data.map((objective) => {
      let relatedTasks = this.taskRelatedToObjectiveService.fillTaskFromObjectives(objective.id);

      return {
        id: objective.id,
        title: objective.title,
        dueDate: objective.dueDate,
        description: objective.description,
        relatedTasks: relatedTasks,
        numberOfTaskDone: relatedTasks.filter((task) => task.done).length,
      }
    });
  });

  consultObjective = (id: string) => {
    this.router.navigate(['/objectives', id]);
  }

}
