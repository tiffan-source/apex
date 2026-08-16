export abstract class AIProvider {
  abstract generateMessage(prompt: string): Promise<string>;
}
