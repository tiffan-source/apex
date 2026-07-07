import { computed, inject, Injectable } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { toSignal } from '@angular/core/rxjs-interop';
import { ObjectieViewModel, ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";
import { UpdateDoneStatusOfTaskUsecase } from "libs/objective/src/lib/usecases/update-done-status-of-task.usecase";
import { TaskRelatedToObjectiveService } from "apps/apex-client/src/chore/services/task-related-to-objective.service";
import { SubObjectiveRelatedToObjectiveService } from "apps/apex-client/src/chore/services/sub-objective-related-to-objective.service";
import { TaskStore } from "apps/apex-client/src/chore/stores/task.store";

@Injectable()
export class ObjectiveOverviewServices {
  private readonly route = inject(ActivatedRoute);
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);
  private readonly updateDoneStatusOfTaskUsecase = inject(UpdateDoneStatusOfTaskUsecase);
  private readonly taskRelatedToObjectiveService = inject(TaskRelatedToObjectiveService);
  private readonly subObjectiveRelatedToObjectiveService = inject(SubObjectiveRelatedToObjectiveService);

  private readonly params = toSignal(this.route.paramMap);

  toogleTaskDone = async (taskId: string, done: boolean) => {

    // even before the operation is completed, we can optimistically update the task's done status in the store
    this.taskStore.setTaskDone(taskId, done);

    let result = await this.updateDoneStatusOfTaskUsecase.execute(taskId, done);

    if (!result.success) {
      // Revert the optimistic update if the operation fails
      this.taskStore.setTaskDone(taskId, !done);
    }

  }

  objectiveData = computed(()=>{
    const id = this.params()?.get('id');

    let data = this.objectiveStore.objectives().find((objective) => objective.id === id);

    return this.objectiveStore.objectives().find((objective) => objective.id === id) || {} as ObjectieViewModel
  })

  subObjectives = computed(()=>{
    const id = this.params()?.get('id');

    let result = this.subObjectiveRelatedToObjectiveService.fillSubObjectiveFromObjectives(id || "");

    return result;
  });

  objectiveTasks = computed(()=>{
    const id = this.params()?.get('id');

    let result = this.taskRelatedToObjectiveService.fillTaskFromObjectives(id || "");

    return result;
  })

  currentObjectiveId = computed(()=>{
    return this.params()?.get('id') || "";
  })
}
