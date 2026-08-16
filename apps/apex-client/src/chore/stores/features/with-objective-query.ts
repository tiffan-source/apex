import { computed, inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withComputed, withMethods } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { GetAllObjectiveAndTaskQuery } from "@org/objective";
import { from, pipe, switchMap, tap } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";

export function withObjectiveQuery() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>() },
    withComputed(({objectives, tasks}) => ({
      mainObjectivesWithProgress: computed(() => ObjectiveMapper.toObjectivesWithProgress(objectives(), tasks())),
    })),
    withMethods((store, objectiveService = inject(GetAllObjectiveAndTaskQuery)) => ({
      loadObjectives: rxMethod<{ ownerId: string }>(
        pipe(
          tap(() => patchState(store, { requestStatus: "pending" })),
          switchMap(({ ownerId }) =>
            from(objectiveService.execute({ ownerId })).pipe(
              tapResponse({
                next: (data) => patchState(store, { ...ObjectiveMapper.fromLoadToObjectiveViewModels(data), requestStatus: "fulfilled" }),
                error: (error)=>{
                  console.error(error);
                  patchState(store, { requestStatus: {error: "Failed to load objectives"} });
                },
              })
            )
          )
        )
      ),
      findObjectiveOverViewById: (id: string) => ObjectiveMapper.objectiveOverviewDetail(id, store.objectives(), store.tasks()),
      clearObjectives: () => patchState(store, { objectives: [], tasks: [] }),
    }))
  );
}
