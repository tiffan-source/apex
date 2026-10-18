import { CallResult, IToolExecutor, IToolRegistry, ToolCall, ToolExecutionContext } from "../workflow/actors.protocols";

export class ToolExecutor implements IToolExecutor {

  constructor(
    private readonly registry: IToolRegistry
  ) {}

  async execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<CallResult> {

    const tool = this.registry.get(toolCall.name);

    console.log(toolCall.arguments)

    const parsedInput = tool.inputSchema.parse(
      toolCall.arguments
    );

    const result = await tool.execute(
      context,
      parsedInput
    );

    return {
      id: toolCall.id,
      functionName: tool.name,
      result
    };
  }
}
