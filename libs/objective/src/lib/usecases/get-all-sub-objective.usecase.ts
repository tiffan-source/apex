import { Result, runWithResult } from "@org/chore";
import { ObjectiveRepository } from "../protocols/objective.repository";

export type SubObjectiveOutput = {
  id: string;
  title: string;
  description?: string;
  dueDate?: Date;
  subObjectives: string[];
  tasks: string[];
};

export class GetAllSubObjectiveUseCase {
  constructor(private readonly objectiveRepository: ObjectiveRepository) {}

  async execute(): Promise<Result<SubObjectiveOutput[]>> {
    return runWithResult<SubObjectiveOutput[]>(
      async () => {
        let objectives = await this.objectiveRepository.findAll();

        return objectives.map((objective) => {
          return {
            id: objective.id,
            title: objective.title,
            description: objective.description,
            dueDate: objective.dueDate,
            subObjectives: objective.subObjectives?.map((subObjective) => subObjective.id) || [],
            tasks: objective.tasks?.map((task) => task.id) || []
          };
        });
      },
      [],
      'Failed to get all sub-objectives'
    );
  }
}
