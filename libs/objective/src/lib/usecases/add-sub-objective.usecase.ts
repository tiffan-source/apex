import { IdGenerator, Result, runWithResult } from "@org/chore";
import { ObjectiveRepository } from "../protocols/objective.repository";
import { Objective } from "../models/objective";
import { ObjectiveNotFoundError } from "../errors/objective-not-found.error";
import {FailToSaveObjectiveError} from "../errors/fail-to-save-objective.error";

export interface AddSubObjectiveOutput {
  id: string;
  title: string;
}

export class AddSubObjectiveUsecase {
  constructor(
    private readonly repository: ObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}


  async execute(parentObjectiveId: string, title: string): Promise<Result<AddSubObjectiveOutput>> {
    return runWithResult<AddSubObjectiveOutput>(
      async () => {
        let parentObjective = await this.repository.findById(parentObjectiveId);

        if (!parentObjective) {
          throw new ObjectiveNotFoundError(parentObjectiveId);
        }

        let subObjectiveId = this.idGenerator.generateId();
        let subObjective = new Objective(subObjectiveId, title);

        parentObjective.addSubObjective(subObjective);

        let result = await this.repository.save(parentObjective);

        if (!result) {
          throw new FailToSaveObjectiveError(parentObjectiveId);
        }

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
