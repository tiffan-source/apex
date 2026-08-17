import { inject } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";

export class Section {
  protected readonly objectiveStore = inject(ObjectiveStore);

  toggleTaskDone(taskId: string, done: boolean) {
    this.objectiveStore.udpateTaskDone({ taskId, done: !done });
  }
}
