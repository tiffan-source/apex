import { IdGenerator, Result, runWithResult } from  "@org/chore";
import { MainObjective } from "../models/objective";
import { MainObjectiveRepository } from "../protocols/objective.repository";

export interface CreateObjectiveInput {
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
}

export interface CreateObjectiveOutput {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
}

export class CreateObjective {

  constructor(
    private readonly repository: MainObjectiveRepository,
    private readonly idGenerator: IdGenerator,
  ) {}

   async execute(input: CreateObjectiveInput): Promise<Result<CreateObjectiveOutput>> {
    return runWithResult<CreateObjectiveOutput>(
      async () => {
        let id = this.idGenerator.generateId();
        let newObjective = new MainObjective(id, input.title);

        if (input.description) {
          newObjective.setDescription(input.description);
        }

        if (input.why) {
          newObjective.setWhy(input.why);
        }

        if (input.dueDate) {
          newObjective.setDueDate(input.dueDate);
        }

        let result = await this.repository.save(newObjective);

        if (!result) {
          throw new Error('Failed to save objective');
        }

        return {
          id: newObjective.id,
          title: newObjective.title,
          description: newObjective.description,
          why: newObjective.why,
          dueDate: newObjective.dueDate,
        };
      },
      [],
      'Failed to create objective'
    );
   }
}
