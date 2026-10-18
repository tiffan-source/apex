import { Provider } from "@angular/core";
import { InteractiveAIProvider } from "@org/ai";
import { AIService, ChatService, GetObjectiveTreeTool, IAIActor, IChatActor, IToolExecutionPolicy, IToolExecutor, IToolRegistry, IWorkflowStateRepository, SendMessageToAIWorkflow, ToolExecutor, ToolPolicy, ToolRegistry } from "@org/ai-assistant"
import { AddMessageCommand, GetConversationsQuery } from "@org/chat";
import { IdGenerator } from "@org/chore";
import { FirebaseClientDataAccess, FirebaseWorkflowStateRepository } from "@org/firebase";
import { ObjectiveInternalService } from "@org/objective";

export const WorkflowProvider: Provider[] = [
  {
    provide: SendMessageToAIWorkflow, useFactory: (
    chatService: IChatActor,
    aiService: IAIActor,
    toolExecutor: IToolExecutor,
    toolPolicy: IToolExecutionPolicy,
    toolRegistry: IToolRegistry,
    workflowStateRepository: IWorkflowStateRepository
  ) => new SendMessageToAIWorkflow(chatService, aiService, toolExecutor, toolPolicy, toolRegistry, workflowStateRepository),
    deps: [IChatActor, IAIActor, IToolExecutor, IToolExecutionPolicy, IToolRegistry, IWorkflowStateRepository]
  },
  {
    provide: IWorkflowStateRepository, useFactory: (
      firebaseClient: FirebaseClientDataAccess
    ) => new FirebaseWorkflowStateRepository(firebaseClient),
    deps: [FirebaseClientDataAccess]
  },
  {
    provide: IChatActor, useFactory: (
      conversationQuery: GetConversationsQuery,
      messageCommand: AddMessageCommand,
      idGenerator: IdGenerator) => new ChatService(conversationQuery, messageCommand, idGenerator),
      deps: [GetConversationsQuery, AddMessageCommand, IdGenerator]
  },
  {
    provide: IToolRegistry, useFactory: (
      allObjectiveTools: GetObjectiveTreeTool
    ) => new ToolRegistry([allObjectiveTools]),
    deps: [GetObjectiveTreeTool]
  },
  {
    provide: GetObjectiveTreeTool, useFactory: (
      objectiveService: ObjectiveInternalService
    ) => new GetObjectiveTreeTool(objectiveService),
    deps: [ObjectiveInternalService]
  },
  {
    provide: IAIActor, useFactory: (
      aiProvider: InteractiveAIProvider
    ) => new AIService(aiProvider),
    deps: [InteractiveAIProvider]
  },
  {
    provide: IToolExecutor, useFactory: (
      toolRegistry: IToolRegistry,
    ) => new ToolExecutor(toolRegistry),
    deps: [IToolRegistry]
  },
  {
    provide: IToolExecutionPolicy, useFactory: (
      toolRegistry: IToolRegistry
    ) => new ToolPolicy(toolRegistry),
    deps: [IToolRegistry]
  }
]
