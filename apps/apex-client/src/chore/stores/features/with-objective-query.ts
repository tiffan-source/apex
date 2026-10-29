import { inject } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ObjectivesResponse } from "../../api/api.models";
import { errorCodeOf } from "../../api/api-error";
import { Observable, defer, from, of, pipe, switchMap, tap } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { keepOptimistic } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { ObjectivesLoadedState } from "./with-objectives-loaded";
import { AnnoncesStore } from "../annonces.store";
import { failureReport } from "../../constants/messages.constante";

export function withObjectiveQuery() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState & ObjectivesLoadedState>() },
    withMethods((
      store,
      objectivesApi = inject(ObjectivesApi),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    ) => {
      /**
       * Une lecture de l'API (GET /v1/objectives), dans la file d'écritures, qui ne rend que ce que l'écran peut
       * montrer. Un geste fait après la mise en file d'un rechargement (cocher, modifier, déplacer un pas chargé)
       * a déjà changé l'écran, mais il n'est écrit qu'après la lecture : plus ancienne que lui, elle l'effacerait
       * de l'écran alors qu'il est enregistré. Elle est alors laissée de côté, et l'API relue après ces écritures.
       * Au premier chargement, rien n'est encore à l'écran : seules des créations ont pu être faites pendant la
       * lecture, et keepOptimistic les garde. La lecture vaut tout de suite, sans attendre leur écriture.
       */
      const readAfterWrites = (): Observable<ObjectivesResponse> =>
        defer(() => {
          const read = writes.run(() => objectivesApi.list());
          const mark = writes.enqueued;
          return from(read).pipe(
            switchMap((data) =>
              writes.enqueued === mark || !store.objectivesLoaded() ? of(data) : readAfterWrites()
            )
          );
        });

      return {
      /**
       * Charge les objectifs et les pas de la personne connectée (l'API la reconnaît à son jeton), qui
       * remplacent l'état. Le chargement prend place dans la file d'écritures : il lit après les écritures déjà
       * parties, et relit si un geste a été fait pendant qu'il attendait (readAfterWrites). Les éléments encore
       * optimistes (id temporaire : un objectif, une étape ou un pas en cours de création) sont gardés au
       * remplacement, sinon ils disparaîtraient jusqu'au prochain chargement.
       */
      loadObjectives: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { requestStatus: "pending" })),
          switchMap(() =>
            readAfterWrites().pipe(
              tapResponse({
                next: (data) => patchState(store, {
                  ...keepOptimistic(ObjectiveMapper.fromLoadToObjectiveViewModels(data), {
                    objectives: store.objectives(),
                    tasks: store.tasks(),
                  }),
                  objectivesLoaded: true,
                  requestStatus: "fulfilled",
                }),
                error: (error)=>{
                  console.error(error);
                  const report = failureReport('loadObjectives', errorCodeOf(error));
                  annonces.signaler(report);
                  patchState(store, { requestStatus: { error: report } });
                },
              })
            )
          )
        )
      ),
      /** Vide l'état à la déconnexion : plus rien n'est chargé. */
      clearObjectives: () => patchState(store, { objectives: [], tasks: [], objectivesLoaded: false }),
      };
    })
  );
}
