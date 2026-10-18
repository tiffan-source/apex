import { ObjectiveInternalService, ObjectiveTreeOutput } from "@org/objective";
import { Tool, ToolExecutionContext } from "../workflow/actors.protocols";
import { z } from "zod";

const getObjectiveTreeInput = z.object({
  id: z.string()
});

export class GetObjectiveTreeTool implements Tool<typeof getObjectiveTreeInput, ObjectiveTreeOutput | null> {

  readonly name = "getObjectiveTree";

  readonly description =
    "Get the complete tree under an objective";

  readonly inputSchema = getObjectiveTreeInput;

  constructor(
    private readonly objectiveService: ObjectiveInternalService
  ) {}

  async execute(
    context: ToolExecutionContext,
    input: z.infer<typeof getObjectiveTreeInput>
  ): Promise<ObjectiveTreeOutput | null> {
    console.log(`Executing tool ${this.name} for user ${context.userId} and objective ${context.objectiveId}`);
    return this.objectiveService.getObjectiveTree(input.id);
  }
}
