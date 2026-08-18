import { Objective } from "../models/objective";

export abstract class ObjectiveRepository {

  abstract save(
    objective: Objective,
    ownerId: string,
  ): Promise<boolean>;

  abstract findById(
    id: string,
  ): Promise<Objective | null>;

  abstract findObjectiveWithASpecificTaskId(
    taskId: string,
  ): Promise<Objective | null>;

}
