import { inject, untracked } from "@angular/core";
import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ObjectiveTreeResponse } from "../../api/api.models";
import { errorCodeOf, retryWhileTransient } from "../../api/api-error";
import { Observable, Subject, defer, from, of, pipe, switchMap, takeUntil, tap } from "rxjs";
import { tapResponse } from "@ngrx/operators";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { keepOptimistic } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { ObjectivesLoadedState } from "./with-objectives-loaded";
import { AnnoncesStore } from "../annonces.store";
import { FAILURE_REPORTS, failureReport } from "../../constants/messages.constante";

/** Les nouveaux essais d'une relecture avant de dire que le serveur ne répond pas : environ 7 s. */
export const RELOAD_RETRIES_BEFORE_REPORT = 4;

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
       * Une lecture de l'API (GET /v2/bff/objective-tree), dans la file d'écritures, qui ne rend que ce que l'écran peut
       * montrer. Un geste fait après la mise en file d'un rechargement (cocher, modifier, déplacer un pas chargé)
       * a déjà changé l'écran, mais il n'est écrit qu'après la lecture : plus ancienne que lui, elle l'effacerait
       * de l'écran alors qu'il est enregistré. Elle est alors laissée de côté, et l'API relue après ces écritures.
       * Au premier chargement, rien n'est encore à l'écran : seules des créations ont pu être faites pendant la
       * lecture, et keepOptimistic les garde. La lecture vaut tout de suite, sans attendre leur écriture.
       */
      const readAfterWrites = (): Observable<ObjectiveTreeResponse> =>
        defer(() => {
          const read = writes.run(() => objectivesApi.objectiveTree());
          const mark = writes.enqueued;
          return from(read).pipe(
            switchMap((data) =>
              writes.enqueued === mark || !store.objectivesLoaded() ? of(data) : readAfterWrites()
            )
          );
        });

      /**
       * Une relecture : l'écran montre déjà les objectifs (au chargement, quand l'issue d'une commande est
       * inconnue, après ce qu'Akari écrit ; jamais après un geste accepté). Elle continue tant que la panne est passagère : au bout de quelques essais, la personne
       * apprend que le serveur ne répond pas ; la note s'en va dès qu'il répond.
       */
      const rereadUntilAnswered = (): Observable<ObjectiveTreeResponse> =>
        readAfterWrites().pipe(
          retryWhileTransient<ObjectiveTreeResponse>({
            onRetry: (retryCount) => {
              if (retryCount === RELOAD_RETRIES_BEFORE_REPORT) annonces.signaler(FAILURE_REPORTS.reloadObjectives);
            },
          })
        );

      // Plus personne n'est connecté : une lecture encore en route n'a plus à arriver, ni à recommencer.
      const signedOut = new Subject<void>();

      return {
      /**
       * Charge les objectifs et les pas de la personne connectée (l'API la reconnaît à son jeton), qui
       * remplacent l'état. Le chargement prend place dans la file d'écritures : il lit après les écritures déjà
       * parties, et relit si un geste a été fait pendant qu'il attendait (readAfterWrites). Les éléments encore
       * optimistes (id temporaire : un objectif, une étape ou un pas en cours de création) sont gardés au
       * remplacement, sinon ils disparaîtraient jusqu'au prochain chargement. Le premier chargement n'a rien à
       * montrer : il dit tout de suite s'il n'aboutit pas ; une relecture insiste (rereadUntilAnswered).
       */
      loadObjectives: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { requestStatus: "pending" })),
          switchMap(() =>
            // Appelé depuis un effet (la personne a changé) : ce signal ne doit pas le relancer.
            (untracked(store.objectivesLoaded) ? rereadUntilAnswered() : readAfterWrites()).pipe(
              takeUntil(signedOut),
              tapResponse({
                next: (data) => {
                  annonces.retirer(FAILURE_REPORTS.loadObjectives);
                  annonces.retirer(FAILURE_REPORTS.reloadObjectives);
                  patchState(store, {
                    ...keepOptimistic(ObjectiveMapper.fromObjectiveTree(data), {
                      objectives: store.objectives(),
                      tasks: store.tasks(),
                    }),
                    objectivesLoaded: true,
                    requestStatus: "fulfilled",
                  });
                },
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
      /** Vide l'état à la déconnexion : plus rien n'est chargé, ni en route. */
      clearObjectives: () => {
        signedOut.next();
        annonces.retirer(FAILURE_REPORTS.reloadObjectives);
        patchState(store, { objectives: [], tasks: [], objectivesLoaded: false, requestStatus: "idle" });
      },
      };
    })
  );
}
