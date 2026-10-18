import { createActor, Actor, SnapshotFrom } from 'xstate';
import { getMachine } from "./machine";
import { IAIActor, IChatActor, IToolExecutionPolicy, IToolExecutor, IToolRegistry } from "./actors.protocols";
import { IWorkflowStateRepository, WorkflowStateValue } from "../model/workflow.model";
import { createBrowserInspector } from '@statelyai/inspect';

type ConversationMachine = ReturnType<typeof getMachine>;

export type MessageInput = {
  message: string;
  objectiveId: string;
  ownerId: string;
}

export type MessageOutput = {
  id: string;
  response: string;
  createdAt: Date;
}

export class SendMessageToAIWorkflow {

  private actors = new Map<string, Actor<ConversationMachine>>();
  private machine: ConversationMachine;

  constructor(
    chatService: IChatActor,
    aiService: IAIActor,
    toolExecutor: IToolExecutor,
    toolPolicy: IToolExecutionPolicy,
    toolRegistry: IToolRegistry,
    private workflowStateRepository: IWorkflowStateRepository
  ) {
    this.machine = getMachine(
      chatService,
      aiService,
      toolExecutor,
      toolPolicy,
      toolRegistry
    )

  }

  /**
   * Start the single workflow identified by `id` (the objective / chat id).
   * Resumes it when it is already running in memory or was previously persisted,
   * otherwise starts a brand new workflow. Returns the same `id`.
   */
  async startWorkFlow(id: string): Promise<string> {
    if (this.actors.has(id)) {
      return id;
    }

    const resumed = await this.restore(id);

    if (!resumed) {
      const { inspect } = createBrowserInspector();
      const actor = createActor(this.machine, { inspect });
      this.trackAndStart(id, actor);
    }

    return id;
  }

  /**
   * Restore a previously persisted workflow and resume it under its original id.
   * Returns false when no workflow is stored for that id.
   */
  async restore(id: string): Promise<boolean> {
    const state = await this.workflowStateRepository.findById(id);

    if (!state) {
      return false;
    }

    const snapshot = this.machine.resolveState({
      value: state.value,
      context: state.context,
    });
    const actor = createActor(this.machine, { snapshot });

    this.trackAndStart(id, actor);

    return true;
  }


  sendMessage(actorId: string, userId: string, objectiveId: string, message: string) {
    this.actors.get(actorId)?.send({
      type: "message.send",
      userId,
      objectiveId,
      prompt: message
    });
  }

  getState(actorId: string) {
    return this.actors.get(actorId)?.getSnapshot();
  }

  /**
   * Persist the workflow state on every transition, register the actor, then start it.
   */
  private trackAndStart(id: string, actor: Actor<ConversationMachine>) {
    actor.subscribe((snapshot) => {
      this.persist(id, snapshot).catch((error) =>
        console.error(`Failed to persist workflow ${id}:`, error)
      );
    });

    actor.start();

    this.actors.set(id, actor);
  }

  private async persist(id: string, snapshot: SnapshotFrom<ConversationMachine>): Promise<void> {
    await this.workflowStateRepository.save({
      id,
      value: snapshot.value as WorkflowStateValue,
      context: snapshot.context,
    });
  }

}
