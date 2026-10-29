import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { inject } from "@angular/core";
import { ObjectivesApi } from "../../api/objectives.api";
import { errorCodeOf } from "../../api/api-error";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { filter, from, map, mergeMap, pipe, tap } from "rxjs";
import { whenSignedIn } from "../utils/filter-auth-operation";
import { isTemporaryId } from "../utils/map-optimistique-id";
import { WriteQueue } from "../utils/write-queue";
import { SessionStore } from "../session.store";
import { AnnoncesStore } from "../annonces.store";
import { ObjectiveViewModel } from "../../models/objective.viewmodel";
import { tapResponse } from "@ngrx/operators";
import { SUCCESS_ANNOUNCEMENTS, failureReport } from "../../constants/messages.constante";

const sameContent = (a: ObjectiveViewModel, b: ObjectiveViewModel) =>
  a.title === b.title && a.description === b.description && a.why === b.why && a.dueDate === b.dueDate;

export function withEditObjective() {
  return signalStoreFeature(
    {state: type<ObjectiveState & RequestStatusState>()},
    withMethods((store,
      objectivesApi = inject(ObjectivesApi),
      sessionStore = inject(SessionStore),
      annonces = inject(AnnoncesStore),
      writes = inject(WriteQueue)
    )=>{
      /**
       * Remet l'objectif tel qu'il était avant la modification optimiste, sauf si un geste plus récent
       * l'a déjà changé (ce geste-là part ensuite et aura sa propre réponse).
       */
      const restore = (oldObj: ObjectiveViewModel, optimistic: ObjectiveViewModel) => {
        const id = writes.resolve(oldObj.id);
        patchState(store, {
          objectives: store.objectives().map((obj) =>
            obj.id === id && sameContent(obj, optimistic) ? { ...oldObj, id, parentId: obj.parentId } : obj
          ),
        });
      };

      return {
        /**
         * Modifie un objectif ou une étape, d'abord dans l'état puis par l'API ; retour en arrière si
         * l'enregistrement n'aboutit pas. Un champ absent (undefined) reste inchangé côté API.
         */
        editObjective: rxMethod<{id: string, title: string; description?: string; why?: string; dueDate?: Date }>(
          pipe(
            whenSignedIn(sessionStore.isAuthenticated),
            map((data)=>({...data, oldObj: store.objectives().find(obj=>obj.id === data.id)})),
            // Rien à modifier si l'objectif n'est pas (ou plus) chargé
            filter((data): data is typeof data & { oldObj: ObjectiveViewModel } => data.oldObj !== undefined),
            map((data) => ({
              ...data,
              optimistic: {
                id: data.id,
                title: data.title,
                description: data.description || "",
                why: data.why || "",
                dueDate: data.dueDate?.toISOString() || "",
                parentId: data.oldObj.parentId
              } satisfies ObjectiveViewModel,
            })),
            tap(({ id, optimistic })=>{
              patchState(store, {requestStatus: 'pending'});
              patchState(store, {objectives: store.objectives().map((obj)=> obj.id === id ? optimistic : obj)});
            }),
            mergeMap(({title, id, description, dueDate, why, oldObj, optimistic})=>
              from(writes.run(async () => {
                const objectiveId = writes.resolve(id);
                if (isTemporaryId(objectiveId)) return null; // sa création n'a pas abouti (déjà signalé)
                return objectivesApi.edit(objectiveId, { title, description, why, dueDate: dueDate?.toISOString() });
              })).pipe(
                tapResponse({
                  next: (saved) =>{
                    if (saved === null) {
                      patchState(store, {requestStatus: 'idle'});
                      return;
                    }
                    annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveSaved);
                    patchState(store, {requestStatus: 'fulfilled'});
                  },
                  error: (error)=>{
                    console.error(error);
                    const report = failureReport('editObjective', errorCodeOf(error));
                    annonces.signaler(report);
                    patchState(store, {requestStatus: {error: report}});
                    restore(oldObj, optimistic);
                  }
                })
              )
            )
          )
        )
      };
    })
  )
}
