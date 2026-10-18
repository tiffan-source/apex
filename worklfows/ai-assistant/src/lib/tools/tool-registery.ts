import { ObjectiveInternalService } from "@org/objective";
import { IToolRegistry, Tool } from "../workflow/actors.protocols";
import { GetObjectiveTreeTool } from "./get-objective-tree.tool";

export class ToolRegistry implements IToolRegistry {

  constructor(
    private readonly tools: Tool[]
  ) {

  }

  get(name: string): Tool {
    const tool = this.tools.find(
      tool => tool.name === name
    );

    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }

    return tool;
  }

  getAll(): Tool[] {
    return this.tools;
  }
}
