import { Objective, ObjectiveRepository} from "@org/objective";
import { Task } from "libs/objective/src/lib/models/task";

type ObjectiveDbModel = {
  id: string;
  title: string;
  description?: string;
  why?: string;
  dueDate?: Date;
  subObjectives?: ObjectiveDbModel[];
  tasks?: {
    id: string;
    title: string;
    importance?: number;
    urgency?: number;
  }[];
};

const toObjective = (model: ObjectiveDbModel): Objective => {
  const objective = new Objective(model.id, model.title);

  if (model.description) {
    objective.setDescription(model.description);
  }

  if (model.why) {
    objective.setWhy(model.why);
  }

  if (model.dueDate) {
    objective.setDueDate(model.dueDate);
  }

  if (model.tasks) {
    model.tasks.forEach(task => {
      let taskInstance = new Task(task.id, task.title);
      if (task.importance !== undefined) {
        taskInstance.setImportance(task.importance);
      }
      if (task.urgency !== undefined) {
        taskInstance.setUrgency(task.urgency);
      }
      objective.addTask(taskInstance);
    });
  }

  model.subObjectives?.forEach(subObjective => {
    objective.addSubObjective(toObjective(subObjective));
  });


  return objective;
};

const toDbModel = (objective: Objective): ObjectiveDbModel => ({
  id: objective.id,
  title: objective.title,
  description: objective.description,
  why: objective.why,
  dueDate: objective.dueDate,
  subObjectives: objective.subObjectives.map(toDbModel),
  tasks: objective.tasks.map(task => ({
    id: task.id,
    title: task.title,
    importance: task.importance,
    urgency: task.urgency
  }))
});

export class InMemoryObjectiveRepository implements ObjectiveRepository {
  private objectives: ObjectiveDbModel[] = [
    {
      id: 'obj-1',
      title: 'Initial objective',
      description: 'Seeded objective for local development',
      dueDate: new Date('2024-12-31'),
      subObjectives: [
        {
          id: 'sub-obj-1',
          title: 'First sub-objective',
          description: 'A sub-objective for the initial objective',
          dueDate: new Date('2024-11-30'),
          tasks: [
            {
              id: 'task-1',
              title: 'First task for initial objective',
              importance: 5,
              urgency: 3
            },
            {
              id: 'task-2',
              title: 'First task for second objective',
              importance: 4,
              urgency: 2
            }
          ]
        }
      ]
    },
    {
      id: 'obj-2',
      title: 'Second objective',
      description: 'Another seeded objective',
      dueDate: new Date('2025-01-15')
    },
  ];

  async save(objective: Objective): Promise<boolean> {
    const objectiveModel = toDbModel(objective);

    if (!this.objectives.find(obj => obj.id === objective.id)) {
      this.objectives.push(objectiveModel);
    }

    this.objectives = this.objectives.map(obj => obj.id === objective.id ? objectiveModel : obj);

    return true;
  }

  async findAll(): Promise<Objective[]> {
    return this.objectives.map(toObjective);
  }

  async findById(id: string): Promise<Objective | null> {
    const objective = this.objectives.find(obj => obj.id === id);
    return objective ? toObjective(objective) : null;
  }
}
