import { inject, Injectable, signal } from "@angular/core";
import { AddSubObjectiveUsecase } from "@org/objective";
import { ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";

@Injectable({providedIn: 'root'})
export class AddSubObjectiveServices {
  private readonly addSubObjectiveUsecase = inject(AddSubObjectiveUsecase);
  private readonly objectiveStore = inject(ObjectiveStore);
  public isAdding = signal(false);

  addSubObjective = async (objectiveId: string, subObjectiveTitle: string) => {
    this.isAdding.set(true);
    let result = await this.addSubObjectiveUsecase.execute(objectiveId, subObjectiveTitle);
    if(result.success) {
      this.objectiveStore.addSubObjective(objectiveId, {
        id: result.data.id,
        title: result.data.title,
        description: '',
        why: '',
        dueDate: null,
        subObjectives: [],
        tasks: []
      });
    }
    this.isAdding.set(false);
  }
}
