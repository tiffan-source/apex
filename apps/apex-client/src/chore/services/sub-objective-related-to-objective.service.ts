import { inject, Injectable } from "@angular/core";
import { ObjectieViewModel, ObjectiveStore } from "../stores/objective.store";

@Injectable({ providedIn: 'root' })
export class SubObjectiveRelatedToObjectiveService {
  private readonly objectivesStore = inject(ObjectiveStore);

  public fillSubObjectiveFromObjectives = (objectivesId: string): ObjectieViewModel[] => {

    let result: ObjectieViewModel[] = [];


    let objective = [...this.objectivesStore.objectives(), ...this.objectivesStore.subObjectives()].find((objective) => objective.id === objectivesId);

    if (!objective) {
      return result;
    }

    result.push(...objective.subObjectives.map((subObjectiveId) => {
      let subObjective = this.objectivesStore.subObjectives().find((objective) => objective.id === subObjectiveId);
      if (subObjective) {
        return subObjective;
      }
      return null;
    }).filter((subObjective) => subObjective !== null) as ObjectieViewModel[]);

    objective.subObjectives.forEach((subObjectiveId) => {
      result.push(...this.fillSubObjectiveFromObjectives(subObjectiveId));
    });

    return result;
  }

}
