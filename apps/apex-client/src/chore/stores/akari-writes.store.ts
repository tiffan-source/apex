import { inject } from '@angular/core';
import { signalStore, withMethods } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { first, map, mergeMap, pipe, tap, timer } from 'rxjs';
import { SendMessageToAIWorkflow, type WorkflowStateValue } from '@org/ai-assistant';
import { ObjectiveStore } from './objective.store';
import { SessionStore } from './session.store';

/** L'intervalle d'interrogation du workflow, comme ChatStore (le workflow ne pousse rien). */
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
 * À l'accord sur un outil d'écriture, ChatStore lui confie l'id du workflow. Le workflow passe aussitôt à
 * l'exécution de l'outil ({ ExecutingAllTool: 'ExecutingTool' }) ; dès qu'il en sort (nouvelle demande d'accord,
 * envoi du résultat à l'IA, repos…), l'écriture est faite : les objectifs sont rechargés, une fois. Deux ajouts
 * acceptés dans un même tour donnent deux rechargements, chacun après son écriture.
 */
export const AkariWritesStore = signalStore(
  withMethods(
    (
      store,
      workflow = inject(SendMessageToAIWorkflow),
      objectives = inject(ObjectiveStore),
      session = inject(SessionStore),
    ) => ({
      /** Recharge les objectifs dès que l'outil accepté sur ce workflow a fini de s'exécuter. */
      reloadAfterWrite: rxMethod<string>(
        pipe(
          mergeMap((workflowId) =>
            timer(0, AKARI_WRITE_POLL_INTERVAL).pipe(
              map(() => workflow.getState(workflowId)),
              first((snapshot) => !isExecutingTool(snapshot?.value as WorkflowStateValue | undefined)),
              tap(() => {
                const ownerId = session.currentUserId();
                if (ownerId) objectives.loadObjectives({ ownerId });
              }),
            ),
          ),
        ),
      ),
    }),
  ),
);
