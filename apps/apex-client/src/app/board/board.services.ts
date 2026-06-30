import { computed, inject, Injectable } from "@angular/core";
import { ObjectiveStore } from "../../chore/stores/objective.store";
import { Router } from "@angular/router";

@Injectable({ providedIn: 'root' })
export class BoardServices {
  private readonly objectivesStore = inject(ObjectiveStore);
  private readonly router = inject(Router);

  getAllObjectives = computed(() => {
    let data = this.objectivesStore.objectives();
    return data;
  });

  consultObjective = (id: string) => {
    this.router.navigate(['/objectives', id]);
  }
}
