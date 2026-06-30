import { inject, Injectable, signal } from "@angular/core";
import { CreateObjective } from "@org/objective";
import { ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";

@Injectable({
  providedIn: 'root'
})
export class CreateObjectiveServices {
  private readonly objectiveStore = inject(ObjectiveStore);
  private readonly createObjective = inject(CreateObjective);
  isCreating = signal(false);

  createObjectiveService = async (title: string, description: string, why: string, dueDate: Date) : Promise<boolean> => {
    this.isCreating.set(true);

    let result = await this.createObjective.execute({
      title,
      description,
      why,
      dueDate
    });


    // a little timer
    await new Promise(resolve => setTimeout(resolve, 1000));

    //optimistic update
    if(result.success) {
      this.objectiveStore.addObjective({
        id: result.data.id,
        title: result.data.title,
        description: result.data.description || '',
        why: result.data.why || '',
        dueDate: result.data.dueDate || null,
        subObjectives: [],
        tasks: []
      });
    }

    this.isCreating.set(false);

    return result.success;
  }
}
