import { Result, runWithResult } from "@org/chore";
import { Objective } from "../models/objective";
import { ObjectiveRepository } from "../protocols/objective.repository";

type ObjectiveOutput = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
  subObjectives: ObjectiveOutput[];
  tasks: { id: string; title: string, urgent?: number, important?: number }[];
};

export class GetAllObjectiveUseCase {

  constructor(private readonly objectiveRepository: ObjectiveRepository) {}

  async execute(): Promise<Result<ObjectiveOutput[]>> {
    return runWithResult<ObjectiveOutput[]>(
      async () => {
        let objectives = await this.objectiveRepository.findAll();
        return objectives.map((objective) => {
          return {
            id: objective.id,
            title: objective.title,
            description: objective.description,
            why: objective.why,
            dueDate: objective.dueDate,
            subObjectives: objective.subObjectives?.map((subObjective) => ({
              id: subObjective.id,
              title: subObjective.title,
              description: subObjective.description,
              why: subObjective.why,
              dueDate: subObjective.dueDate,
              subObjectives: [] as ObjectiveOutput[],
              tasks: subObjective.tasks?.map((task) => ({
                id: task.id,
                title: task.title,
                urgent: task.urgency,
                important: task.importance
              })) || []
            })) || [],
            tasks: objective.tasks?.map((task) => ({
              id: task.id,
              title: task.title,
              urgent: task.urgency,
              important: task.importance
            })) || []
          };
        });
      },
      [],
      'Failed to get all objectives'
    );
  }
}
