import { Result, runWithResult } from "@org/chore";
import { TaskRepository } from "../protocols/task.repository";
import { Task } from "../models/task";
import { ObjectiveRepository } from "../protocols/objective.repository";

export type WhatIsTodayFocusOutput = {
  id: string;
  title: string;
  objectiveId: string;
  important: number;
  urgent: number;
  dueDate?: Date;
  done: boolean
}[];

export class WhatIsTodayFocusUsecase {

  constructor(
    private readonly repository: TaskRepository,
    private readonly objRepo: ObjectiveRepository
  ) {}

  async execute(userId: string): Promise<Result<WhatIsTodayFocusOutput>> {
    return runWithResult<WhatIsTodayFocusOutput>(
      async ()=> {
        let tasks = await this.repository.getAllUserTasks(userId);
        let today = new Date();

        const todayFocusTasks = [...tasks].sort((a, b) => {
          if(a.importance + a.urgency > b.importance + b.urgency) return -1;
          if(a.importance + a.urgency < b.importance + b.urgency) return 1;
          if(a.dueDate && !b.dueDate) return -1;
          if(!a.dueDate && b.dueDate) return 1;
          if(a.dueDate && b.dueDate) {
            if(a.dueDate < b.dueDate) return -1;
            if(a.dueDate > b.dueDate) return 1;
          }
          return 0;
        }).slice(0, 5);

        return Promise.all(todayFocusTasks.map(async (task) => ({
          id: task.id,
          title: task.title,
          objectiveId: await this.objRepo.findObjectiveWithASpecificTaskId(task.id).then(obj => obj?.id || ''),
          important: task.importance,
          urgent: task.urgency,
          dueDate: task.dueDate,
          done: task.done
        })));
      },
      [],
      "Failed to get today focus tasks"
    )
  }

}
