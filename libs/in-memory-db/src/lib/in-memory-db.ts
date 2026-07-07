import { MainObjective, MainObjectiveRepository, Objective, ObjectiveRepository, TodoBase} from "@org/objective";
import { Task } from "libs/objective/src/lib/models/task";
import { TaskRepository } from "libs/objective/src/lib/protocols/task.repository";

type ObjectiveDbModel = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
  subObjectives?: string[];
  tasks?: string[];
  importance?: number;
  urgency?: number;
  done: boolean;
  type: 'mainObjective' | 'objective' | 'task';
};


function mapTodoBaseToDbModel(todo: TodoBase): ObjectiveDbModel {
  let result = {
    id: todo.id,
    title: todo.title,
    description: todo.description,
    dueDate: todo.dueDate,
    done: todo.done,
  };

  if (todo instanceof Objective) {
    return {
      ...result,
      subObjectives: todo.subObjectives.map((subObjective) => subObjective.id),
      tasks: todo.tasks.map((task) => task.id),
      type: 'objective',
    };
  }

  if (todo instanceof MainObjective) {
    return {
      ...result,
      why: todo.why,
      subObjectives: todo.subObjectives.map((subObjective) => subObjective.id),
      type: 'mainObjective',
    };
  }

  if (todo instanceof Task) {
    return {
      ...result,
      importance: todo.importance,
      urgency: todo.urgency,
      done: todo.done,
      type: 'task',
    };
  }

  throw new Error("Unsupported TodoBase type");
}

class TodoBaseInMemoryRepository {
  protected db: ObjectiveDbModel[] = [
    {
      id: "m1",
      title: "Launch Product X",
      description: "Main objective to successfully launch Product X to market",
      why: "Capture new market segment and increase revenue",
      dueDate: new Date("2026-12-31"),
      subObjectives: ["o1", "o2"],
      tasks: [],
      done: false,
      type: 'mainObjective',
    },
    {
      id: "o1",
      title: "Complete MVP",
      description: "Build and validate minimum viable product",
      dueDate: new Date("2026-06-30"),
      subObjectives: [],
      tasks: ["t1", "t2"],
      done: false,
      type: 'objective',
    },
    {
      id: "o2",
      title: "Marketing Prep",
      description: "Prepare go-to-market materials and campaigns",
      dueDate: new Date("2026-10-15"),
      subObjectives: [],
      tasks: ["t3"],
      done: false,
      type: 'objective',
    },
    {
      id: "t1",
      title: "Implement core features",
      description: "Develop authentication, main workflow and data storage",
      importance: 9,
      urgency: 8,
      dueDate: new Date("2026-04-30"),
      done: false,
      type: 'task',
    },
    {
      id: "t2",
      title: "Run usability tests",
      description: "Conduct sessions with target users to gather feedback",
      importance: 7,
      urgency: 6,
      dueDate: new Date("2026-05-15"),
      done: false,
      type: 'task',
    },
    {
      id: "t3",
      title: "Prepare launch deck",
      description: "Create marketing deck and content calendar",
      importance: 6,
      urgency: 5,
      dueDate: new Date("2026-09-01"),
      done: false,
      type: 'task',
    },
  ];

  save(todo: TodoBase): Promise<boolean> {
    let dbModel = mapTodoBaseToDbModel(todo);
    this.db.push(dbModel);
    return Promise.resolve(true);
  }

}

export class InMemoryTaskRepository extends TodoBaseInMemoryRepository implements TaskRepository {
  findById(id: string): Promise<Task | null> {
    let dbModel = this.db.find((item) => item.id === id);
    if (!dbModel) {
      return Promise.resolve(null);
    }

    let task = new Task(dbModel.id, dbModel.title, dbModel.importance || 0, dbModel.urgency || 0);

    if (dbModel.description) {
      task.setDescription(dbModel.description);
    }

    if (dbModel.dueDate) {
      task.setDueDate(dbModel.dueDate);
    }

    if (dbModel.importance !== undefined) {
      task.setImportance(dbModel.importance);
    }

    if (dbModel.urgency !== undefined) {
      task.setUrgency(dbModel.urgency);
    }

    task.setDone(dbModel.done);

    return Promise.resolve(task);
  }

  findAll(): Promise<Task[]> {
    let tasks = this.db.filter((dbModel) => dbModel.type === 'task').map((dbModel) => {
      let task = new Task(dbModel.id, dbModel.title, dbModel.importance || 0, dbModel.urgency || 0);

      if (dbModel.description) {
        task.setDescription(dbModel.description);
      }

      if (dbModel.dueDate) {
        task.setDueDate(dbModel.dueDate);
      }

      if (dbModel.importance !== undefined) {
        task.setImportance(dbModel.importance);
      }

      if (dbModel.urgency !== undefined) {
        task.setUrgency(dbModel.urgency);
      }

      task.setDone(dbModel.done);

      return task;
    });

    return Promise.resolve(tasks);
  }
}

export class InMemoryObjectiveRepository extends TodoBaseInMemoryRepository implements ObjectiveRepository {
  findById(id: string): Promise<Objective | null> {
    let dbModel = this.db.find((item) => item.id === id);
    if (!dbModel) {
      return Promise.resolve(null);
    }

    let objective = new Objective(dbModel.id, dbModel.title);

    if (dbModel.description) {
      objective.setDescription(dbModel.description);
    }

    if (dbModel.dueDate) {
      objective.setDueDate(dbModel.dueDate);
    }

    objective.setDone(dbModel.done);

    return Promise.resolve(objective);
  }

  findAll(): Promise<Objective[]> {
    let objectives = this.db.filter((dbModel) => dbModel.type === 'objective').map((dbModel) => {
      let objective = new Objective(dbModel.id, dbModel.title);

      if (dbModel.description) {
        objective.setDescription(dbModel.description);
      }

      if (dbModel.dueDate) {
        objective.setDueDate(dbModel.dueDate);
      }

      if (dbModel.subObjectives) {
        dbModel.subObjectives.forEach((subObjectiveId) => {
          let subObjectiveDbModel = this.db.find((item) => item.id === subObjectiveId);
          if (subObjectiveDbModel) {
            let subObjective = new Objective(subObjectiveDbModel.id, subObjectiveDbModel.title);
            objective.addSubObjective(subObjective);
          }
        });
      }

      if (dbModel.tasks) {
        dbModel.tasks.forEach((taskId) => {
          let taskDbModel = this.db.find((item) => item.id === taskId);
          if (taskDbModel) {
            let task = new Task(taskDbModel.id, taskDbModel.title, taskDbModel.importance || 0, taskDbModel.urgency || 0);
            objective.addTask(task);
          }
        });
      }

      objective.setDone(dbModel.done);

      return objective;
    });

    return Promise.resolve(objectives);
  }
}

export class InMemoryMainObjectiveRepository extends TodoBaseInMemoryRepository implements MainObjectiveRepository {
  findById(id: string): Promise<MainObjective | null> {
    let dbModel = this.db.find((item) => item.id === id);
    if (!dbModel) {
      return Promise.resolve(null);
    }

    let mainObjective = new MainObjective(dbModel.id, dbModel.title);

    if (dbModel.description) {
      mainObjective.setDescription(dbModel.description);
    }
    if (dbModel.dueDate) {
      mainObjective.setDueDate(dbModel.dueDate);
    }
    mainObjective.setDone(dbModel.done);

    if (dbModel.why) {
      mainObjective.setWhy(dbModel.why);
    }


    if (dbModel.subObjectives) {
      dbModel.subObjectives.forEach((subObjectiveId) => {
        let subObjectiveDbModel = this.db.find((item) => item.id === subObjectiveId);
        if (subObjectiveDbModel) {
          let subObjective = new Objective(subObjectiveDbModel.id, subObjectiveDbModel.title);
          mainObjective.addSubObjective(subObjective);
        }
      });
    }

    return Promise.resolve(mainObjective);
  }

  findAll(): Promise<MainObjective[]> {
    let mainObjectives = this.db.filter((dbModel) => dbModel.type === 'mainObjective').map((dbModel) => {
      let mainObjective = new MainObjective(dbModel.id, dbModel.title);

      if (dbModel.description) {
        mainObjective.setDescription(dbModel.description);
      }

      if (dbModel.dueDate) {
        mainObjective.setDueDate(dbModel.dueDate);
      }

      if (dbModel.done) {
        mainObjective.setDone(dbModel.done);
      }

      if (dbModel.why) {
        mainObjective.setWhy(dbModel.why);
      }

      if (dbModel.subObjectives) {
        dbModel.subObjectives.forEach((subObjectiveId) => {
          let subObjectiveDbModel = this.db.find((item) => item.id === subObjectiveId);
          if (subObjectiveDbModel) {
            let subObjective = new Objective(subObjectiveDbModel.id, subObjectiveDbModel.title);
            mainObjective.addSubObjective(subObjective);
          }
        });
      }

      return mainObjective;
    });
    return Promise.resolve(mainObjectives);
  }
}
