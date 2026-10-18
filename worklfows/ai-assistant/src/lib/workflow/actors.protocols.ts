import { z } from "zod";

// #region ai actors protocols

export type AIResponse = {
  id: string;
  response: Response;
}


export abstract class Response {
  abstract responseType: "text" | "toolCall" | "error";
}

export class TextResponse extends Response {
  responseType: "text" = "text";

  readonly response: string;

  constructor(text: string) {
    super();
    this.response = text;
  }
}

export class ToolCallResponse extends Response {
  responseType: "toolCall" = "toolCall";

  readonly toolCalls: ToolCall[];

  constructor(calls: ToolCall[]) {
    super();
    this.toolCalls = calls;
  }
}


export abstract class IAIActor {
  abstract getAIMessage(prompt: string, previousInteractionId?: string, tools?: Tool[]): Promise<AIResponse>;
  // The fact I'm using CallResult here is a bit of a code smell, but I don't want to create a new type just for this. I think it's fine for now, but we might want to revisit this later.
  abstract sendToolCallResult(interactionId: string, toolCallResult: CallResult[]): Promise<AIResponse>;
}


// #endregion

// #region chat actors protocols

/**
 * A message that has been persisted in a conversation, as reported back by the
 * chat actor once it owns a real id. The UI uses it to display the message
 * without having to reload the whole conversation.
 */
export type RegisteredMessage = {
  id: string;
  content: string;
  sender: string;
  createdAt: Date;
};

export type RegisterMessageResult = {
  success: boolean;
  message: RegisteredMessage | null;
};

export abstract class IChatActor {
  abstract registerMessage(conversationExternalRef: string, message: string, actorId: string): Promise<RegisterMessageResult>;
}

// #endregion

// #region tool actors protocols

export interface ToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface CallResult {
  id: string;
  functionName: string;
  result: unknown;
}

export interface ToolExecutionContext {
  userId: string;
  objectiveId: string;
}

export interface Tool<  TInput extends z.ZodType = z.ZodType, TOutput = unknown> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TInput;
  /**
   * Outil qui modifie les données : son exécution requiert une confirmation
   * explicite de l'utilisateur (policy `ask-user`). Absent/`false` = lecture,
   * exécution directe.
   */
  readonly requiresPermission?: boolean;

  execute(
    context: ToolExecutionContext,
    input: z.infer<TInput>
  ): Promise<TOutput>;
}

export abstract class IToolExecutor {
  abstract execute(
    toolCall: ToolCall,
    context: ToolExecutionContext
  ): Promise<CallResult>;
}

export type ToolExecutionDecision =
  | {
      type: "execute";
    }
  | {
      type: "ask-user";
      reason: string;
    }
  | {
      type: "deny";
      reason: string;
    };

export abstract class IToolExecutionPolicy {
  abstract decide(
    tool: ToolCall,
    context: ToolExecutionContext,
    input: unknown
  ): Promise<ToolExecutionDecision>;
}

export abstract class IToolRegistry {

  abstract get(name: string): Tool;

  abstract getAll(): Tool[];
}

// #endregion
