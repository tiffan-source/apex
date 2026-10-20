import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals"
import { TaskViewModel } from "../models/objective.viewmodel"
import { computed, effect, inject } from "@angular/core"
import { SessionStore } from "./session.store"
import { rxMethod } from "@ngrx/signals/rxjs-interop"
import { from, pipe, switchMap, tap } from "rxjs"
import { WhatIsTodayFocusUsecase } from "@org/objective"
import { tapResponse } from "@ngrx/operators"
import { AnnoncesStore } from "./annonces.store"
import { failureReport } from "../constants/messages.constante"
import { ObjectiveStore } from "./objective.store"

export type FocusTaskState = {
  tasksId: string[],
  loading: boolean,
}

const initialState: FocusTaskState = {
  tasksId: [],
  loading: false
}

export const FocusTaskStore = signalStore(
  withState<FocusTaskState>(initialState),
  withComputed((store, objectiveStore = inject(ObjectiveStore))=>({
    tasksWithObjective: computed(()=>{
      const objectives = objectiveStore.objectives();
      const tasks = objectiveStore.tasks();
      // Les pas du jour peuvent arriver avant les objectifs : un pas pas encore chargé est ignoré
      return store.tasksId()
        .map((taskId)=>tasks.find((t)=>t.id === taskId))
        .filter((task): task is TaskViewModel => task !== undefined)
        .map((task)=>({
          ...task,
          objectiveTitle: objectives.find((obj)=>obj.id === task.objectiveId)?.title || "Objectif inconnu"
        }))
    }),
    taskTotal: computed(()=>{
      return store.tasksId().length;
    }),

  })),
  withComputed((store) =>({
    taskDone: computed(()=>{
      const tasksWithObjective = store.tasksWithObjective();
      return tasksWithObjective.filter((task)=>task.done).length;
    })
  })),
  withMethods((store,
    focusUsecase = inject(WhatIsTodayFocusUsecase),
    annonces = inject(AnnoncesStore),
  )=>({
    loadFocusTask: rxMethod<{userId: string}>(
      pipe(
        tap(()=>patchState(store, {loading: true})),
        switchMap(({userId})=>
          from(focusUsecase.execute(userId)).pipe(
          tapResponse({
            next: (data)=>{
              if(data.success) {
                patchState(store, {tasksId: data.data.map((t)=>t.id), loading: false})
              }else{
                annonces.signaler(failureReport('loadFocus', data.error.code))
              }
              patchState(store, {loading: false})
            },
            error: (error)=>{
              console.error(error);
              annonces.signaler(failureReport('loadFocus'))
              patchState(store, {loading: false})
            }
          })
        )),
      )
    ),
    clearFocusTask: ()=>{
      patchState(store, {tasksId: []})
    }
  })),
  withHooks((store, session = inject(SessionStore))=>({
    onInit() {
      effect(()=>{
        const userId = session.currentUserId();
        if(userId) {
          store.loadFocusTask({userId});
        } else {
          store.clearFocusTask();
        }
      })
    }
  }))
)
