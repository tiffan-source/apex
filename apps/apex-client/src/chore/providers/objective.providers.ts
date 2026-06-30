import { Provider } from "@angular/core"
import { IdGenerator } from "@org/chore"
import {AddSubObjectiveUsecase, AddTaskToObjectiveUsecase, CreateObjective, GetAllObjectiveUseCase, ObjectiveRepository} from "@org/objective"
import { InMemoryObjectiveRepository } from "@org/in-memory-db"

export const ObjectiveProviders: Provider[] = [
  {provide: ObjectiveRepository, useClass: InMemoryObjectiveRepository},
  {provide: CreateObjective, useFactory: (idGenerator: IdGenerator, objectiveRepository: ObjectiveRepository) => new CreateObjective(objectiveRepository, idGenerator), deps: [IdGenerator, ObjectiveRepository]},
  {provide: GetAllObjectiveUseCase, useFactory: (objectiveRepository: ObjectiveRepository) => new GetAllObjectiveUseCase(objectiveRepository), deps: [ObjectiveRepository]},
  {provide: AddSubObjectiveUsecase, useFactory: (objectiveRepository: ObjectiveRepository, idGenerator: IdGenerator) => new AddSubObjectiveUsecase(objectiveRepository, idGenerator), deps: [ObjectiveRepository, IdGenerator]},
  {provide: AddTaskToObjectiveUsecase, useFactory: (objectiveRepository: ObjectiveRepository, idGenerator: IdGenerator) => new AddTaskToObjectiveUsecase(objectiveRepository, idGenerator), deps: [ObjectiveRepository, IdGenerator]}
]
