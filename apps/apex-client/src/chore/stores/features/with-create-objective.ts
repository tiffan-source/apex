import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods, withState } from "@ngrx/signals";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { pickFields, replaceFieldsIfShown } from "../utils/command-fields";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { from, map, mergeMap, pipe, tap } from "rxjs";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { swapObjectiveId, withOptimistiqueId } from "../utils/map-optimistique-id";
import { RequestStatusState } from "../utils/loading-feature";
import { WriteQueue } from "../utils/write-queue";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

export type CreateObjectiveState = {
  /**
   * L'identifiant définitif du dernier objectif créé, une fois enregistré ; null pendant l'enregistrement
   * (il est remis à null à chaque nouvelle création) et si l'enregistrement n'a pas abouti.
   * Sert à ouvrir l'objectif (/objectifs/:id/akari) après « Je m'y engage ».
   */
  lastCreatedObjectiveId: string | null;
};

export function withCreateObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withState<CreateObjectiveState>({ lastCreatedObjectiveId: null }),
    withMethods((store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      /** Retire l'objectif optimiste et ce qui a été posé dessus entre-temps. */
      const removeTemporary = (tempId: string) =>
        patchState(store, {
          objectives: store.objectives().filter((obj) => obj.id !== tempId && obj.parentId !== tempId),
        });

      return {
      /** Crée un objectif, d'abord dans l'état (id temporaire) puis par l'API ; lastCreatedObjectiveId donne l'id définitif. */
      createObjective: rxMethod<{ title: string; description?: string; why?: string; dueDate?: Date }>(
        pipe(
          whenSignedIn(sessionStore.isAuthenticated),
          withOptimistiqueId(),
          map((data) => ({
            ...data,
            shown: {
              id: data.tempId,
              title: data.title,
              description: data.description || "",
              why: data.why || "",
              dueDate: data.dueDate?.toISOString() || "",
              parentId: null,
              done: false,
            } satisfies ObjectiveViewModel,
          })),
          tap(({ shown }) => {
            patchState(store, { requestStatus: 'pending', lastCreatedObjectiveId: null });
            patchState(store, { objectives: [...store.objectives(), shown] });
          }),
          // mergeMap + file d'écritures : deux créations rapprochées reçoivent chacune leur réponse
          mergeMap(({ title, description, why, dueDate, tempId, shown }) =>
            from(writes.run(() => objectivesApi.createObjective({ title, description, why, dueDate: dueDate?.toISOString() }))).pipe(
              tapResponse({
                next: (created) => {
                  const realId = created.id;
                  writes.link(tempId, realId);
                  const swapped = swapObjectiveId({ objectives: store.objectives(), tasks: store.tasks() }, tempId, realId);
                  const fields = pickFields(shown, ['title', 'description', 'why', 'dueDate', 'done']);
                  patchState(store, {
                    // L'objectif prend ce que l'API rend, sauf ce qu'un geste plus récent a changé.
                    objectives: replaceFieldsIfShown(swapped.objectives, realId, fields, ObjectiveMapper.toObjectiveViewModel(created)),
                    tasks: swapped.tasks,
                    lastCreatedObjectiveId: realId,
                    requestStatus: 'fulfilled'
                  });

                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveCreated);
                },
                error: (error) => {
                  console.error(error);
                  const report = failureReport('createObjective', errorCodeOf(error));
                  annonces.signaler(report);
                  removeTemporary(tempId);
                  patchState(store, { requestStatus: { error: report } });
                  // L'API a pu l'enregistrer avant que sa réponse se perde : elle dit ce qui est vrai.
                  if (isUnknownOutcome(error)) store.loadObjectives();
                },
              })
            )
          )
        )
      ),
      };
    })
  );
}
