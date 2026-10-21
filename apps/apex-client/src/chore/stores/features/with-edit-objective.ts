import { patchState, signalStoreFeature, type, withMethods } from "@ngrx/signals";
import { ObjectiveState } from "../objective.store";
import { RequestStatusState } from "../utils/loading-feature";
import { inject } from "@angular/core";
import { EditObjectiveUsecase } from "@org/objective";
import { rxMethod } from "@ngrx/signals/rxjs-interop";
import { filter, from, map, mergeMap, pipe, tap } from "rxjs";
import { withOwnerId } from "../utils/filter-auth-operation";
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
      editObjective = inject(EditObjectiveUsecase),
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
        /** Modifie un objectif ou une étape, d'abord dans l'état puis en base ; retour en arrière si l'enregistrement n'aboutit pas. */
        editObjective: rxMethod<{id: string, title: string; description?: string; why?: string; dueDate?: Date }>(
          pipe(
            withOwnerId(sessionStore.currentUserId),
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
            mergeMap(({title, id, ownerId, description, dueDate, why, oldObj, optimistic})=>
              from(writes.run(async () => {
                const objectiveId = writes.resolve(id);
                if (isTemporaryId(objectiveId)) return null; // sa création n'a pas abouti (déjà signalé)
                return editObjective.execute({
                  objective: { id: objectiveId, title, description, dueDate, why },
                  ownerId
                });
              })).pipe(
                tapResponse({
                  next: (data) =>{
                    if (data === null) {
                      patchState(store, {requestStatus: 'idle'});
                    } else if (data.success) {
                      annonces.annoncer(SUCCESS_ANNOUNCEMENTS.objectiveSaved);
                      patchState(store, {requestStatus: 'fulfilled'});
                    } else {
                      const report = failureReport('editObjective', data.error.code);
                      annonces.signaler(report);
                      restore(oldObj, optimistic);
                      patchState(store, {requestStatus: {error: report}});
                    }
                  },
                  error: (error)=>{
                    console.error(error);
                    const report = failureReport('editObjective');
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
