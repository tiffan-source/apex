import { IdGenerator, Result, runWithResult } from "@org/chore";
import { MainObjectiveRepository, ObjectiveRepository } from "../protocols/objective.repository";
import { Objective } from "../models/objective";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import {FailToSaveObjectiveError} from "../errors/fail-to-save-objective.error";

export interface AddSubObjectiveOutput {
  id: string;
  title: string;
}

export class AddSubObjectiveUsecase {
  constructor(
    private readonly mainRepository: MainObjectiveRepository,
    private readonly subRepository: ObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}


  async execute(parentObjectiveId: string, title: string): Promise<Result<AddSubObjectiveOutput>> {
    return runWithResult<AddSubObjectiveOutput>(
      async () => {
        let parentObjective = await this.mainRepository.findById(parentObjectiveId);

        if (!parentObjective) {
          throw new ObjectiveNotFoundError(parentObjectiveId);
        }

        let subObjectiveId = this.idGenerator.generateId();
        let subObjective = new Objective(subObjectiveId, title);

        parentObjective.addSubObjective(subObjective);

        await this.subRepository.save(subObjective);
        await this.mainRepository.save(parentObjective);

        return {
          id: subObjective.id,
          title: subObjective.title,
        };
      },
      [ObjectiveNotFoundError, FailToSaveObjectiveError],
      'Failed to add sub-objective'
    )
  }
}
