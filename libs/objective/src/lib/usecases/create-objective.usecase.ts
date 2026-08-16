import { IdGenerator, Result, runWithResult } from  "@org/chore";
import { Objective } from "../models/objective";
import { ObjectiveRepository } from "../protocols/objective.repository";
import { FailToSaveObjectiveError } from "../errors/fail-to-save-objective.error";

export interface CreateObjectiveInput {
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
  ownerId: string;
}

export interface CreateObjectiveOutput {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
}

export class CreateObjectiveUsecase {

  constructor(
    private readonly repository: ObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

   async execute(input: CreateObjectiveInput): Promise<Result<CreateObjectiveOutput>> {
    return runWithResult<CreateObjectiveOutput>(
      async () => {
        let id = this.idGenerator.generateId();
        let newObjective = new Objective(id, input.title);

        if (input.description) {
          newObjective.setDescription(input.description);
        }

        if (input.why) {
          newObjective.setWhy(input.why);
        }

        if (input.dueDate) {
          newObjective.setDueDate(input.dueDate);
        }

        let result = await this.repository.save(newObjective, input.ownerId);

        if (!result) {
          throw new FailToSaveObjectiveError(id);
        }

        return {
          id: newObjective.id,
          title: newObjective.title,
          description: newObjective.description,
          why: newObjective.why,
          dueDate: newObjective.dueDate,
        };
      },
      [FailToSaveObjectiveError],
      'Failed to create objective'
    );
   }
}
