import { Provider } from "@angular/core"
import { IdGenerator } from "@org/chore"
import {AddSubObjectiveUsecase, AddTaskToObjectiveUsecase, CreateObjective, GetAllObjectiveUseCase, ObjectiveRepository, UpdateDoneStatusOfTaskUsecase, MainObjectiveRepository, TaskRepository, GetAllTaskUseCase, GetAllSubObjectiveUseCase} from "@org/objective"
import { InMemoryObjectiveRepository, InMemoryMainObjectiveRepository, InMemoryTaskRepository } from "@org/in-memory-db"

export const ObjectiveProviders: Provider[] = [
  {provide: ObjectiveRepository, useClass: InMemoryObjectiveRepository},
  {provide: MainObjectiveRepository, useClass: InMemoryMainObjectiveRepository},
  {provide: TaskRepository, useClass: InMemoryTaskRepository},
  {provide: CreateObjective, useFactory: (idGenerator: IdGenerator, objectiveRepository: MainObjectiveRepository) => new CreateObjective(objectiveRepository, idGenerator), deps: [IdGenerator, MainObjectiveRepository]},
  {provide: GetAllObjectiveUseCase, useFactory: (objectiveRepository: MainObjectiveRepository) => new GetAllObjectiveUseCase(objectiveRepository), deps: [MainObjectiveRepository]},
  {provide: AddSubObjectiveUsecase, useFactory: (mainRepository: MainObjectiveRepository, subRepository: ObjectiveRepository, idGenerator: IdGenerator) => new AddSubObjectiveUsecase(mainRepository, subRepository, idGenerator), deps: [MainObjectiveRepository, ObjectiveRepository, IdGenerator]},
  {provide: AddTaskToObjectiveUsecase, useFactory: (objectiveRepository: ObjectiveRepository, taskRepository: TaskRepository, idGenerator: IdGenerator) => new AddTaskToObjectiveUsecase(objectiveRepository, taskRepository, idGenerator), deps: [ObjectiveRepository, TaskRepository, IdGenerator]},
  {provide: UpdateDoneStatusOfTaskUsecase, useFactory: (taskRepository: TaskRepository) => new UpdateDoneStatusOfTaskUsecase(taskRepository), deps: [TaskRepository]},
  {provide: GetAllTaskUseCase, useFactory: (taskRepository: TaskRepository) => new GetAllTaskUseCase(taskRepository), deps: [TaskRepository]},
  {provide: GetAllSubObjectiveUseCase, useFactory: (objectiveRepository: ObjectiveRepository) => new GetAllSubObjectiveUseCase(objectiveRepository), deps: [ObjectiveRepository]}
]
