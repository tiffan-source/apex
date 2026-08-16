import { IdGenerator, Result, runWithResult } from "@org/chore";
import { ObjectiveRepository } from "../protocols/objective.repository";
import { Objective } from "../models/objective";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import {FailToSaveObjectiveError} from "../errors/fail-to-save-objective.error";

export interface AddSubObjectiveInput {
  parentObjectiveId: string;
  title: string;
  ownerId: string;
}

export interface AddSubObjectiveOutput {
  id: string;
  title: string;
}

export class AddSubObjectiveUsecase {
  constructor(
    private readonly objectiveRepository: ObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}


  async execute(input: AddSubObjectiveInput): Promise<Result<AddSubObjectiveOutput>> {
    return runWithResult<AddSubObjectiveOutput>(
      async () => {
        let parentObjective = await this.objectiveRepository.findById(input.parentObjectiveId);

        if (!parentObjective) {
          throw new ObjectiveNotFoundError(input.parentObjectiveId);
        }

        let subObjectiveId = this.idGenerator.generateId();
        let subObjective = new Objective(subObjectiveId, input.title);

        parentObjective.addSubObjective(subObjective);
        
        await this.objectiveRepository.save(parentObjective, input.ownerId);

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
