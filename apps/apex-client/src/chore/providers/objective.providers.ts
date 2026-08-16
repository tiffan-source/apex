import { Provider } from "@angular/core"
import { IdGenerator } from "@org/chore"
import { ObjectiveRepository, TaskRepository, UpdateDoneStatusOfTaskUsecase, GetAllObjectiveAndTaskQuery } from "@org/objective"
import { AddSubObjectiveUsecase, AddTaskToObjectiveUsecase, CreateObjectiveUsecase } from "@org/objective"
import { SupabaseGetAllObjectiveAndTaskQuery } from "@org/supabase"
import { SupabaseClientDataAccess, SupabaseObjectiveRepository, SupabaseTaskRepository } from "@org/supabase"

export const ObjectiveProviders: Provider[] = [
  {provide: ObjectiveRepository, useFactory: (supabaseClient: SupabaseClientDataAccess) => new SupabaseObjectiveRepository(supabaseClient), deps: [SupabaseClientDataAccess]},
  {provide: TaskRepository, useFactory: (supabaseClient: SupabaseClientDataAccess) => new SupabaseTaskRepository(supabaseClient), deps: [SupabaseClientDataAccess]},

  {provide: CreateObjectiveUsecase, useFactory: (idGenerator: IdGenerator, objectiveRepository: ObjectiveRepository) => new CreateObjectiveUsecase(objectiveRepository, idGenerator), deps: [IdGenerator, ObjectiveRepository]},
  {provide: AddSubObjectiveUsecase, useFactory: (repository: ObjectiveRepository, idGenerator: IdGenerator) => new AddSubObjectiveUsecase(repository, idGenerator), deps: [ObjectiveRepository, IdGenerator]},
  {provide: AddTaskToObjectiveUsecase, useFactory: (objectiveRepository: ObjectiveRepository, idGenerator: IdGenerator) => new AddTaskToObjectiveUsecase(objectiveRepository, idGenerator), deps: [ObjectiveRepository, IdGenerator]},
  {provide: UpdateDoneStatusOfTaskUsecase, useFactory: (taskRepository: TaskRepository) => new UpdateDoneStatusOfTaskUsecase(taskRepository), deps: [TaskRepository]},

  {provide: GetAllObjectiveAndTaskQuery, useFactory: (supabaseClient: SupabaseClientDataAccess) => new SupabaseGetAllObjectiveAndTaskQuery(supabaseClient), deps: [SupabaseClientDataAccess]}
]
