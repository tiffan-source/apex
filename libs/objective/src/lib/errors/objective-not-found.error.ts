import { CoreError } from "@org/chore";

export class ObjectiveNotFoundError extends CoreError {
  constructor(objectiveId: string) {
    super('OBJECTIVE_NOT_FOUND', `Objective with ID ${objectiveId} not found`, { objectiveId });
  }
}
