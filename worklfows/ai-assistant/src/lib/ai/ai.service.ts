import { AIResponse, CallResult, IAIActor, TextResponse, Tool, ToolCallResponse } from "../workflow/actors.protocols";
import { AIInteractionResponse, InteractiveAIProvider } from "@org/ai"
import { z } from "zod";

export class AIService implements IAIActor {
  constructor(
    private readonly aiProvider: InteractiveAIProvider
  ) {}

  async getAIMessage(prompt: string, previousInteractionId?: string, tools?: Tool[]): Promise<AIResponse>
  {
    let result = await this.aiProvider.generateMessage({
      prompt,
      previousInteractionId,
      tools: tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: z.toJSONSchema(tool.inputSchema),
      })),
    });

    return this.buildAiResponse(result);
  }


  // The fact I'm using CallResult here is a bit of a code smell, but I don't want to create a new type just for this. I think it's fine for now, but we might want to revisit this later.
  async sendToolCallResult(interactionId: string, toolCallResult: CallResult[]): Promise<AIResponse>
  {
    let result = await this.aiProvider.sendToolCallResult(interactionId, toolCallResult);
    return this.buildAiResponse(result);
  }

  private buildAiResponse(response: AIInteractionResponse): AIResponse {
    if (response.type === "message") {
      return {
        id: response.interactionId,
        response: new TextResponse(response.content)
      }
    } else if (response.type === "tool-call") {
      return {
        id: response.interactionId,
        response: new ToolCallResponse(response.toolCall.map((call) => ({
          id: call.id,
          name: call.name,
          arguments: call.arguments
        })))
      }
    }

    throw new Error("Unexpected response type from AI provider");
  }
}
