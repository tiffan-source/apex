import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { inject } from "@angular/core";
import { ObjectivesApi } from "../../api/objectives.api";
import type { ClarifyObjectiveBody, ObjectiveEntity } from "../../api/api.models";
import { errorCodeOf, isUnknownOutcome } from "../../api/api-error";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { Observable, catchError, filter, forkJoin, from, map, mergeMap, of, pipe, tap } from "rxjs";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { ObjectiveMapper } from "../../mapper/objective.mapper";
import { pickFields, replaceFieldsIfShown } from "../utils/command-fields";
import { forgetObjective } from "../utils/forget";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

/** Ce que modifier un objectif change, une commande par intention. */
type ObjectiveCommand = {
  fields: readonly (keyof ObjectiveViewModel)[];
  send: (objectiveId: string) => Promise<ObjectiveEntity>;
};

export type EditObjectiveInput = {
  id: string;
  title: string;
  /** Absente, la description reste telle quelle ; `""` la vide. */
  description?: string;
  /** Absent, le pourquoi reste tel quel ; `""` le vide. */
  why?: string;
  /** Absente, l'échéance reste telle quelle. */
  dueDate?: Date;
};

export function withEditObjective() {
  return signalStoreFeature(
    { state: type<ObjectiveState & RequestStatusState>(), methods: type<{ loadObjectives: () => unknown }>() },
    withMethods((store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>{
      const replace = (objectiveId: string, shown: Partial<ObjectiveViewModel>, next: Partial<ObjectiveViewModel>) =>
        patchState(store, { objectives: replaceFieldsIfShown(store.objectives(), writes.resolve(objectiveId), shown, next) });

      /** Les commandes du geste : seulement ce qui a changé, dans l'ordre renommer, préciser, donner une échéance. */
      const commandsFor = (oldObj: ObjectiveViewModel, shown: ObjectiveViewModel): ObjectiveCommand[] => {
        const commands: ObjectiveCommand[] = [];
        if (shown.title !== oldObj.title) {
          commands.push({ fields: ['title'], send: (id) => objectivesApi.renameObjective(id, shown.title) });
        }
        const clarify: ClarifyObjectiveBody = {};
        if (shown.description !== oldObj.description) clarify.description = shown.description;
        if (shown.why !== oldObj.why) clarify.why = shown.why;
        const clarified = Object.keys(clarify) as (keyof ClarifyObjectiveBody)[];
        if (clarified.length > 0) {
          commands.push({ fields: clarified, send: (id) => objectivesApi.clarifyObjective(id, clarify) });
        }
        if (shown.dueDate !== oldObj.dueDate && shown.dueDate) {
          commands.push({ fields: ['dueDate'], send: (id) => objectivesApi.setObjectiveDeadline(id, shown.dueDate) });
        }
        return commands;
      };

      /**
       * Une commande dans la file d'écritures. L'API accepte : l'objectif prend ce qu'elle rend pour ces champs.
       * Elle refuse : ces champs seuls reviennent en arrière. Rend vrai si la commande est acceptée.
       */
      const run = (
        objectiveId: string,
        oldObj: ObjectiveViewModel,
        shown: ObjectiveViewModel,
        command: ObjectiveCommand,
      ): Observable<boolean> =>
        from(writes.run(async () => {
          const id = writes.resolve(objectiveId);
          if (isTemporaryId(id)) return null; // sa création n'a pas abouti (déjà signalé)
          return command.send(id);
        })).pipe(
          map((saved) => {
            if (saved === null) return false;
            replace(objectiveId, pickFields(shown, command.fields), pickFields(ObjectiveMapper.toObjectiveViewModel(saved), command.fields));
            return true;
          }),
          catchError((error: unknown) => {
            console.error(error);
            const code = errorCodeOf(error);
            const report = failureReport('editObjective', code);
            annonces.signaler(report);
            patchState(store, { requestStatus: { error: report } });
            if (code === 'OBJECTIVE_NOT_FOUND') {
              patchState(store, forgetObjective({ objectives: store.objectives(), tasks: store.tasks() }, writes.resolve(objectiveId)));
            } else {
              replace(objectiveId, pickFields(shown, command.fields), pickFields(oldObj, command.fields));
              if (isUnknownOutcome(error)) store.loadObjectives();
            }
            return of(false);
          }),
        );

      return {
        /**
         * Modifie un objectif ou une étape, d'abord dans l'état puis par l'API, une commande par intention
         * (renameObjective, clarifyObjective, setObjectiveDeadline), seulement pour ce qui a changé. Chacune est
         * acceptée ou revient en arrière seule ; l'arbre n'est relu que si l'issue de l'une d'elles est inconnue.
         */
        editObjective: rxMethod<EditObjectiveInput>(
          pipe(
            whenSignedIn(sessionStore.isAuthenticated),
            map((data)=>({...data, oldObj: store.objectives().find(obj=>obj.id === data.id)})),
            // Rien à modifier si l'objectif n'est pas (ou plus) chargé
            filter((data): data is typeof data & { oldObj: ObjectiveViewModel } => data.oldObj !== undefined),
            // Un champ absent reste tel qu'il est affiché, comme l'API le laisse en base.
            map(({ id, title, description, why, dueDate, oldObj }) => {
              const shown: ObjectiveViewModel = {
                ...oldObj,
                title,
                description: description ?? oldObj.description,
                why: why ?? oldObj.why,
                dueDate: dueDate?.toISOString() ?? oldObj.dueDate,
              };
              return { id, oldObj, shown, commands: commandsFor(oldObj, shown) };
            }),
            filter(({ commands }) => commands.length > 0),
            tap(({ id, oldObj, shown, commands }) => {
              const fields = commands.flatMap((command) => command.fields);
              patchState(store, {
                requestStatus: 'pending',
                objectives: replaceFieldsIfShown(store.objectives(), id, pickFields(oldObj, fields), pickFields(shown, fields)),
              });
            }),
            mergeMap(({ id, oldObj, shown, commands }) =>
              // Les commandes entrent dans la file tout de suite, dans l'ordre ; forkJoin attend la réponse de chacune.
              forkJoin(commands.map((command) => run(id, oldObj, shown, command))).pipe(
                tap((accepted) => {
                  if (!accepted.every(Boolean)) {
                    if (store.requestStatus() === 'pending') patchState(store, { requestStatus: 'idle' });
                    return;
                  }
                  annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveSaved);
                  patchState(store, { requestStatus: 'fulfilled' });
                }),
              )
            )
          )
        )
      };
    })
  )
}
