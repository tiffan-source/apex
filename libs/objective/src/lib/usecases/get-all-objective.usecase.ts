import { Result, runWithResult } from "@org/chore";
import { MainObjectiveRepository } from "../protocols/objective.repository";

export type MainObjectiveOutput = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
  subObjectives: string[];
};

export class GetAllObjectiveUseCase {

  constructor(private readonly objectiveRepository: MainObjectiveRepository) {}

  async execute(): Promise<Result<MainObjectiveOutput[]>> {
    return runWithResult<MainObjectiveOutput[]>(
      async () => {
        let objectives = await this.objectiveRepository.findAll();

        return objectives.map((objective) => {
          return {
            id: objective.id,
            title: objective.title,
            description: objective.description,
            why: objective.why,
            dueDate: objective.dueDate,
            subObjectives: objective.subObjectives?.map((subObjective) => subObjective.id) || []
          };
        });
      },
      [],
      'Failed to get all objectives'
    );
  }
}
