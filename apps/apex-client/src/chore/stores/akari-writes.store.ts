import { inject } from '@angular/core';
import { signalStore, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, defer, exhaustMap, first, from, mergeMap, of, pipe, retry, switchMap, tap, throwError, timer } from 'rxjs';
import { AssistantApi } from '../api/assistant.api';
import { isTransientError } from '../api/api-error';
import type { WorkflowState, WorkflowStateValue } from '../api/api.models';
import { ObjectiveStore } from './objective.store';

/** L'intervalle d'interrogation du workflow, comme ChatStore (l'API ne pousse rien). */
export const AKARI_WRITE_POLL_INTERVAL = 1000;

/** Le workflow exécute un outil : l'écriture acceptée est en cours. */
export function isExecutingTool(value: WorkflowStateValue | undefined): boolean {
  return (
    typeof value === 'object' && value !== null && (value as Record<string, unknown>)['ExecutingAllTool'] === 'ExecutingTool'
  );
}

/**
 * Ce qu'Akari ajoute avec l'accord de la personne (une étape, un pas) arrive sur l'arête au fil des ajouts
 * (cahier de migration, § 5). Fourni par la coque, à côté d'ObjectiveStore : il survit au départ de l'écran
 * Akari, alors que ChatStore (fourni par l'écran) s'arrête avec lui.
 *
 * À l'accord sur un outil d'écriture, ChatStore lui confie la réponse de l'API à cet accord. Le workflow passe
 * aussitôt à l'exécution de l'outil ({ ExecutingAllTool: 'ExecutingTool' }), sur le serveur ; dès qu'il en sort
 * (nouvelle demande d'accord, envoi du résultat à l'IA, repos…), l'écriture est faite : les objectifs sont
 * rechargés, une fois. Deux ajouts acceptés dans un même tour donnent deux rechargements, chacun après son écriture.
 */
export const AkariWritesStore = signalStore(
  withMethods(
    (
      store,
      assistant = inject(AssistantApi),
      objectives = inject(ObjectiveStore),
    ) => {
      const readState = (objectiveId: string) =>
        defer(() => assistant.state(objectiveId)).pipe(
          retry({
            count: 3,
            delay: (error) => (isTransientError(error) ? timer(AKARI_WRITE_POLL_INTERVAL) : throwError(() => error)),
          }),
        );

      return {
        /** Recharge les objectifs dès que l'outil accepté (`answered` : la réponse de l'API à l'accord) a fini de s'exécuter. */
        reloadAfterWrite: rxMethod<{ objectiveId: string; answered: Promise<WorkflowState> }>(
          pipe(
            mergeMap(({ objectiveId, answered }) =>
              from(answered).pipe(
                switchMap((state) =>
                  isExecutingTool(state.value)
                    ? timer(AKARI_WRITE_POLL_INTERVAL, AKARI_WRITE_POLL_INTERVAL).pipe(
                        exhaustMap(() => readState(objectiveId)),
                        first((polled) => !isExecutingTool(polled.value)),
                      )
                    : of(state),
                ),
                tap(() => objectives.loadObjectives()),
                // L'accord n'a pas abouti (ChatStore le signale), ou l'état n'a pas pu être relu.
                catchError((error) => {
                  console.error(error);
                  return EMPTY;
                }),
              ),
            ),
          ),
        ),
      };
    },
  ),
);
