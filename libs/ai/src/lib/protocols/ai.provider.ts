
export type AITool = {
  name: string;
  description: string;
  parameters: object;
};

export type CallResult = {
  id: string;
  functionName: string
  result: unknown;
}

export type GenerateMessageInput = {
  prompt: string;
  previousInteractionId?: string;
  tools?: AITool[];
};

export type AIToolCall = {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
};

export type AIInteractionResponse =
  | {
      type: "message";
      interactionId: string;
      content: string;
    }
  | {
      type: "tool-call";
      interactionId: string;
      toolCall: AIToolCall[];
    };

export abstract class InteractiveAIProvider {
  abstract generateMessage(
    input: GenerateMessageInput
  ): Promise<AIInteractionResponse>;

  abstract sendToolCallResult(
    interactionId: string,
    toolCallResult: CallResult[]
  ): Promise<AIInteractionResponse>;
}
