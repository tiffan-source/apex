import { inject, Injectable, signal } from "@angular/core";
import { GetAllObjectiveUseCase, GetAllSubObjectiveUseCase, GetAllTaskUseCase } from "@org/objective";
import { fromMainObjectiveDomainToObjectiveViewModel, fromSubObjectiveDomainToObjectiveViewModel, ObjectiveStore } from "../chore/stores/objective.store";
import { fromDomainToTaskViewModel, TaskStore } from "../chore/stores/task.store";

@Injectable({ providedIn: 'root' })
export class AppServices {
  private readonly getAllObjectiveUseCase = inject(GetAllObjectiveUseCase);
  private readonly getAllSubObjectiveUseCase = inject(GetAllSubObjectiveUseCase);
  private readonly getAllTaskUseCase = inject(GetAllTaskUseCase);
  private readonly objectivesStore = inject(ObjectiveStore);
  private readonly taskStore = inject(TaskStore);

  private readonly _isLoading = signal(false);
  readonly isLoading = this._isLoading.asReadonly();

  private bootstrapPromise: Promise<void> | null = null;

  bootstrap = (): Promise<void> => {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      this._isLoading.set(true);
      try {
        const objectivesResult = await this.getAllObjectiveUseCase.execute();
        const subObjectivesResult = await this.getAllSubObjectiveUseCase.execute();
        const tasksResult = await this.getAllTaskUseCase.execute();

        if (objectivesResult.success) {
          this.objectivesStore.setObjectives(objectivesResult.data.map((objective) => fromMainObjectiveDomainToObjectiveViewModel(objective)));
        }

        if (subObjectivesResult.success) {
          this.objectivesStore.setSubObjectives(subObjectivesResult.data.map((subObjective) => fromSubObjectiveDomainToObjectiveViewModel(subObjective)));
        }

        if (tasksResult.success) {
          this.taskStore.setTasks(tasksResult.data.map((task) => fromDomainToTaskViewModel(task)));
        }
      } finally {
        this._isLoading.set(false);
      }
    })();

    return this.bootstrapPromise;
  };
}
