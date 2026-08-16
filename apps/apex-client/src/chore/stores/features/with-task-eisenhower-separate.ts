import { signalStoreFeature, withComputed } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { ApexLibsMetier, EisenhowerCategory } from "@org/apex-library";
import { TaskViewModel, TaskViewModelWithCategory, TaskViewModelWithCategoryAndObjectiveTitle } from "../../models/objective.viewmodel";
import { computed } from "@angular/core";
import { type } from "@ngrx/signals";
import { ObjectiveMapper } from "../../mapper/objective.mapper";

export function withTaskEisenhowerSeparate(){
  return signalStoreFeature(
    { state: type<ObjectiveState>() },
    withComputed(({tasks, objectives}) => ({
      tasksByEisenhowerCategory: computed(() => {
        const categories: Record<EisenhowerCategory, TaskViewModelWithCategoryAndObjectiveTitle[]> = {
          [EisenhowerCategory.DO]: [],
          [EisenhowerCategory.SCHEDULE]: [],
          [EisenhowerCategory.DELEGATE]: [],
          [EisenhowerCategory.DELETE]: [],
        };

        for (const task of tasks()) {
          let category: EisenhowerCategory = ApexLibsMetier.getEisenhowerCategory({...task});
          categories[category].push({
            ...ObjectiveMapper.fromTaskViewModelToCategorizedTaskViewModel(task),
            objectiveTitle: objectives().find(obj => obj.id === task.objectiveId)?.title || 'This is a task without objective',
          });
        }

        return categories;
      }),
    }))

  )
}
