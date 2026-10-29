import { inject } from '@angular/core';
import { signalStore, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, catchError, defer, exhaustMap, first, from, map, mergeMap, of, pipe, switchMap, take, tap, timer } from 'rxjs';
import { AssistantApi } from '../api/assistant.api';
import { isUnknownOutcome, retryWhileTransient } from '../api/api-error';
import type { WorkflowState, WorkflowStateValue } from '../api/api.models';
import { ObjectiveStore } from './objective.store';

/** L'intervalle d'interrogation du workflow, comme ChatStore (l'API ne pousse rien). */
export const AKARI_WRITE_POLL_INTERVAL = 1000;

/**
 * Les lectures de l'état qui voient encore l'outil tourner, au plus (une minute) : au-delà, l'outil est
 * réputé fini et les objectifs sont rechargés quand même.
 */
export const AKARI_WRITE_MAX_POLLS = 60;

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
 *
 * Une panne passagère ne fait rien abandonner : l'état est relu (de plus en plus espacé) jusqu'à ce que le
 * serveur réponde. Si l'état est refusé, ou si l'outil tarde, les objectifs sont rechargés quand même :
 * l'écriture a sans doute eu lieu.
 */
export const AkariWritesStore = signalStore(
  withMethods(
    (
      store,
      assistant = inject(AssistantApi),
      objectives = inject(ObjectiveStore),
    ) => {
      // La fin de l'outil accepté, ou ce qui en tient lieu (un état refusé, un outil qui tarde).
      const toolDone = (objectiveId: string) =>
        timer(AKARI_WRITE_POLL_INTERVAL, AKARI_WRITE_POLL_INTERVAL).pipe(
          exhaustMap(() => defer(() => assistant.state(objectiveId)).pipe(retryWhileTransient())),
          take(AKARI_WRITE_MAX_POLLS),
          first((polled) => !isExecutingTool(polled.value), null),
          map(() => undefined),
          catchError((error) => {
            console.error(error);
            return of(undefined);
          }),
        );

      return {
        /** Recharge les objectifs dès que l'outil accepté (`answered` : la réponse de l'API à l'accord) a fini de s'exécuter. */
        reloadAfterWrite: rxMethod<{ objectiveId: string; answered: Promise<WorkflowState> }>(
          pipe(
            mergeMap(({ objectiveId, answered }) =>
              from(answered).pipe(
                switchMap((state) => (isExecutingTool(state.value) ? toolDone(objectiveId) : of(undefined))),
                catchError((error) => {
                  console.error(error);
                  // L'accord est refusé : rien n'a été écrit (ChatStore le signale). Resté sans réponse claire,
                  // il a pu arriver : on attend la fin de l'outil, comme pour un accord reçu.
                  return isUnknownOutcome(error) ? toolDone(objectiveId) : EMPTY;
                }),
                tap(() => objectives.loadObjectives()),
              ),
            ),
          ),
        ),
      };
    },
  ),
);
