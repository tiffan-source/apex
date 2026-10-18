import { IToolExecutionPolicy, IToolRegistry, Tool, ToolCall, ToolExecutionContext, ToolExecutionDecision,  } from "../workflow/actors.protocols";

export class ToolPolicy implements IToolExecutionPolicy {

  constructor(
    private readonly registry: IToolRegistry
  ) {
  }

  async decide(
    tool: Tool,
    context: ToolExecutionContext,
    input: unknown
  ): Promise<ToolExecutionDecision> {
    try
    {
      if (!this.registry.get(tool.name)) {
        return {
          type: "deny",
          reason: `Tool ${tool.name} is not registered`
        };
      }

      return {
        type: "execute"
      };

    } catch (error) {
      return {
        type: "deny",
        reason: `Tool ${tool.name} is not registered`
      };
    }

  }


}
