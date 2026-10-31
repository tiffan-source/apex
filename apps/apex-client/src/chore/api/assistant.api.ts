import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api.config';
import { request } from './api-error';
import type { ConversationResponse, WorkflowState } from './api.models';

/**
 * La conversation d'un objectif et Akari, par l'API. Le workflow d'Akari (la machine XState, l'IA, les
 * outils) tourne sur le serveur, un par objectif : le client envoie un message ou une réponse à une
 * demande d'accord, puis interroge l'état jusqu'au repos. Seul un objectif principal a une conversation
 * (une étape répond CONVERSATION_NOT_FOUND).
 */
@Injectable({ providedIn: 'root' })
export class AssistantApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/v1/objectives`;

  private objective(objectiveId: string): string {
    return `${this.url}/${encodeURIComponent(objectiveId)}`;
  }

  /** GET /v1/objectives/{objectiveId}/conversation : les messages, dans l'ordre chronologique. */
  conversation(objectiveId: string): Promise<ConversationResponse> {
    return request(this.http.get<ConversationResponse>(`${this.objective(objectiveId)}/conversation`));
  }

  /** GET /v1/objectives/{objectiveId}/assistant : l'état du workflow (un tour interrompu reprend). */
  state(objectiveId: string): Promise<WorkflowState> {
    return request(this.http.get<WorkflowState>(`${this.objective(objectiveId)}/assistant`));
  }

  /** POST …/assistant/messages : le tour démarre (202), la réponse arrive par l'état. WORKFLOW_BUSY pendant un tour. */
  sendMessage(objectiveId: string, message: string): Promise<WorkflowState> {
    return request(this.http.post<WorkflowState>(`${this.objective(objectiveId)}/assistant/messages`, { message }));
  }

  /** POST …/assistant/permission : accepter ou refuser l'outil qui attend (NO_PENDING_PERMISSION s'il n'attend plus). */
  respondToPermission(objectiveId: string, granted: boolean, toolCallId?: string): Promise<WorkflowState> {
    return request(
      this.http.post<WorkflowState>(`${this.objective(objectiveId)}/assistant/permission`, {
        granted,
        ...(toolCallId ? { toolCallId } : {}),
      }),
    );
  }
}
