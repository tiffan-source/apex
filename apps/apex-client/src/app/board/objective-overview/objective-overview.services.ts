import { computed, inject, Injectable } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { toSignal } from '@angular/core/rxjs-interop';
import { ObjectieViewModel, ObjectiveStore } from "apps/apex-client/src/chore/stores/objective.store";

@Injectable()
export class ObjectiveOverviewServices {
  private readonly route = inject(ActivatedRoute);
  private readonly objectiveStore = inject(ObjectiveStore);

  private readonly params = toSignal(this.route.paramMap);

  objectiveData = computed(()=>{
    const id = this.params()?.get('id');

    return this.objectiveStore.objectives().find((objective) => objective.id === id) || {} as ObjectieViewModel
  })

  objectiveTasks = computed(()=>{
    const id = this.params()?.get('id');

    let result = this.objectiveStore.objectives().find((objective) => objective.id === id)?.subObjectives.flatMap((subObjective) => subObjective.tasks) || []

    console.log('objectiveTasks', result);

    return result;
  })

  currentObjectiveId = computed(()=>{
    return this.params()?.get('id') || "";
  })
}
