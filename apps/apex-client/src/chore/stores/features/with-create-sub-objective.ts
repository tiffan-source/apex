import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, mergeMap, pipe, tap } from "rxjs";
import { inject } from "@angular/core";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { replaceFieldsIfShown } from "../utils/command-fields";
import { forgetObjective } from "../utils/forget";
import { isTemporaryId, swapObjectiveId, withOptimistiqueId } from "../utils/map-optimistique-id";
import { tapResponse } from "@ngrx/operators";
import { RequestStatusState } from "../utils/loading-feature";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { WriteQueue } from "../utils/write-queue";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export function withCreateSubObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((store,
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      objectivesApi = inject(ObjectivesApi),
      writes = inject(WriteQueue)
    )=>{
      /** Retire l'étape optimiste, et les pas posés dessus entre-temps. */
      const removeTemporary = (tempId: string) =>
        patchState(store, {
          objectives: store.objectives().filter((obj) => obj.id !== tempId),
          tasks: store.tasks().filter((task) => task.objectiveId !== tempId),
        });

      return {
      /** Ajoute une étape (sous-objectif direct) à un objectif, d'abord dans l'état puis par l'API. */
      addSubObjective: rxMethod<{ objectiveId: string; subObjectiveTitle: string }>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          withOptimistiqueId(),
          tap(({ objectiveId, subObjectiveTitle, tempId }) => {
            patchState(store, { requestStatus: 'pending' });

            const newSubObjective: ObjectiveViewModel = {
              id: tempId,
              title: subObjectiveTitle,
              why: "",
              description: "",
              dueDate: "",
              parentId: objectiveId,
              done: false,
            };

            patchState(store, { objectives: [...store.objectives(), newSubObjective] });
          }),
          mergeMap(({ objectiveId, subObjectiveTitle, tempId }) =>
            from(writes.run(async () => {
              // L'objectif a pu être créé entre-temps : son id définitif est connu ici
              const parentObjectiveId = writes.resolve(objectiveId);
              if (isTemporaryId(parentObjectiveId)) return null; // sa création n'a pas abouti (déjà signalé)
              return objectivesApi.addSubObjective(parentObjectiveId, { title: subObjectiveTitle });
            })).pipe(
              tapResponse({
                next: (created) => {
                  if (created === null) {
                    removeTemporary(tempId);
                    patchState(store, { requestStatus: 'idle' });
                    return;
                  }
                  writes.link(tempId, created.id);
                  const swapped = swapObjectiveId({ objectives: store.objectives(), tasks: store.tasks() }, tempId, created.id);
                  patchState(store, {
                    // L'étape prend ce que l'API rend, sauf ce qu'un geste plus récent a changé.
                    objectives: replaceFieldsIfShown(
                      swapped.objectives,
                      created.id,
                      { title: subObjectiveTitle, description: "", why: "", dueDate: "", done: false },
                      ObjectiveMapper.toObjectiveViewModel(created),
                    ),
                    tasks: swapped.tasks,
                    requestStatus: 'fulfilled'
                  });

                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.stageAdded);
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('addStage', errorCodeOf(error));
                  annonces.signaler(report);
                  removeTemporary(tempId);
                  patchState(store, { requestStatus: { error: report } });
                  if (errorCodeOf(error) === 'OBJECTIVE_NOT_FOUND') {
                    // L'objectif qui devait la porter n'existe plus : il quitte l'écran.
                    patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, writes.resolve(objectiveId)));
                  } else if (isUnknownOutcome(error)) {
                    // L'API a pu l'enregistrer avant que sa réponse se perde : elle dit ce qui est vrai.
                    store.loadObjectives();
                  }
                },
              })
            )
          )
        )
      )
      };
    })
  )
}
