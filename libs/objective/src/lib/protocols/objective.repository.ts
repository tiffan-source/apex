import { MainObjective, Objective } from "../models/objective";

export abstract class MainObjectiveRepository {
  abstract save(objective: MainObjective): Promise<boolean>;
  abstract findAll(): Promise<MainObjective[]>;
  abstract findById(id: string): Promise<MainObjective | null>;
}

export abstract class ObjectiveRepository {
  abstract save(objective: Objective): Promise<boolean>;
  abstract findAll(): Promise<Objective[]>;
  abstract findById(id: string): Promise<Objective | null>;
}
