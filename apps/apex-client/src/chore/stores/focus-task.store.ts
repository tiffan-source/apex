import { patchState, signalStore, withComputed, withHooks, withMethods, withState } from "@ngrx/signals"
import { TaskViewModel } from "../models/objective.viewmodel"
import { computed, effect, inject } from "@angular/core"
import { SessionStore } from "./session.store"
import { rxMethod } from "@ngrx/signals/rxjs-interop"
import { from, pipe, switchMap, tap } from "rxjs"
import { WhatIsTodayFocusUsecase } from "@org/objective"
import { tapResponse } from "@ngrx/operators"
import { MessageService } from "primeng/api"
import { ObjectiveMapper } from "../mapper/objective.mapper"
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
      return store.tasksId().map((taskId)=>{
        const task = objectiveStore.tasks().find((t)=>t.id === taskId) as TaskViewModel;
        const objective = objectives.find((obj)=>obj.id === task.objectiveId);
        return {
          ...task,
          objectiveTitle: objective?.title || "Objectif inconnu"
        }
      })
    }),
    taskTotal: computed(()=>{
      return store.tasksId().length;
    }),

  })),
  withComputed((store) =>({
    taskDone: computed(()=>{
      let tasksWithObjective = store.tasksWithObjective();
      return tasksWithObjective.filter((task)=>task.done).length;
    })
  })),
  withMethods((store,
    focusUsecase = inject(WhatIsTodayFocusUsecase),
    messageService = inject(MessageService),
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
                messageService.add({severity: 'error', summary: 'Erreur', detail: "Impossible de charger les taches du jour"})
              }
              patchState(store, {loading: false})
            },
            error: (error)=>{
              console.error(error);
              messageService.add({severity: 'error', summary: 'Erreur', detail: "Impossible de charger les taches du jour"})
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
