import { inject, Injectable, signal } from "@angular/core";
import { GetAllObjectiveUseCase } from "@org/objective";
import { ObjectiveStore } from "../chore/stores/objective.store";

@Injectable({ providedIn: 'root' })
export class AppServices {
  private readonly getAllObjectiveUseCase = inject(GetAllObjectiveUseCase);
  private readonly objectivesStore = inject(ObjectiveStore);

  private readonly _isLoading = signal(false);
  readonly isLoading = this._isLoading.asReadonly();

  private bootstrapPromise: Promise<void> | null = null;

  bootstrap = (): Promise<void> => {
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = (async () => {
      this._isLoading.set(true);
      try {
        const result = await this.getAllObjectiveUseCase.execute();
        console.log('bootstrap result', result);
        if (result.success) {
          this.objectivesStore.setObjectives(
            result.data.map((objective) => ({
              id: objective.id,
              title: objective.title,
              description: objective.description || '',
              why: objective.why || '',
              dueDate: objective.dueDate || null,
              subObjectives: objective.subObjectives.map((subObjective) => ({
                id: subObjective.id,
                title: subObjective.title,
                description: subObjective.description || '',
                why: subObjective.why || '',
                dueDate: subObjective.dueDate || null,
                subObjectives: [] as any[],
                tasks: subObjective.tasks?.map((task) => ({
                  id: task.id,
                  title: task.title,
                  importance: task.important || 0,
                  urgency: task.urgent || 0,
                })) || []
              })),
              tasks: objective.tasks?.map((task) => ({
                id: task.id,
                title: task.title,
                importance: task.important || 0,
                urgency: task.urgent || 0,
              })) || []
            }))
          );
        }
      } finally {
        this._isLoading.set(false);
      }
    })();

    return this.bootstrapPromise;
  };
}
