import { AIInteractionResponse, CallResult, GenerateMessageInput, InteractiveAIProvider } from "@org/ai"

export type AIProxyTransport = (body: string) => Promise<AIInteractionResponse>;

export class GeminiInteractiveAIProvider
  implements InteractiveAIProvider
{
  constructor(
    private readonly proxyTransport: AIProxyTransport,
  ) { }

  async generateMessage(
    input: GenerateMessageInput,
  ): Promise<AIInteractionResponse> {
    let request = JSON.stringify({
      action: 'generateMessage',
      input,
    });
    return this.proxyTransport(request);
  }

  async sendToolCallResult(
    interactionId: string,
    toolCallResult: CallResult[],
  ): Promise<AIInteractionResponse> {
    let request = JSON.stringify({
      action: 'sendToolCallResult',
      interactionId,
      toolCallResult,
    });
    return this.proxyTransport(request);
  }
}
