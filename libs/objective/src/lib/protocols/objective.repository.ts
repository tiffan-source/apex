import { Objective } from "../models/objective";

export abstract class ObjectiveRepository {
  abstract save(objective: Objective): Promise<boolean>;
  abstract findAll(): Promise<Objective[]>;
  abstract findById(id: string): Promise<Objective | null>;
}
