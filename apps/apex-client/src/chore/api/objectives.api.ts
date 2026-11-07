import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api.config';
import { request } from './api-error';
import type {
  AddSubObjectiveBody,
  AddTaskBody,
  ClarifyObjectiveBody,
  CreateObjectiveBody,
  ObjectiveEntity,
  ObjectiveTreeResponse,
  TaskEntity,
} from './api.models';

/**
 * Les objectifs, les étapes et les pas, par la v2 de l'API : une lecture BFF (l'arbre) et une méthode par
 * commande nommée, qui rend l'objectif ou le pas créé ou changé, sans ses enfants. La règle métier est
 * appliquée par le serveur. Les commandes sur un objectif valent aussi pour une étape. Un échec devient une
 * ApiError (OBJECTIVE_NOT_FOUND, TASK_NOT_FOUND, FAIL_TO_SAVE_OBJECTIVE, VALIDATION_ERROR…), dont les stores
 * tirent leur phrase.
 */
@Injectable({ providedIn: 'root' })
export class ObjectivesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/v2`;

  private objective(objectiveId: string): string {
    return `${this.url}/objectives/${encodeURIComponent(objectiveId)}`;
  }

  private task(taskId: string): string {
    return `${this.url}/tasks/${encodeURIComponent(taskId)}`;
  }

  /** GET /v2/bff/objective-tree (getObjectiveTree) : tous les objectifs de la personne, avec leurs étapes et leurs pas. */
  objectiveTree(): Promise<ObjectiveTreeResponse> {
    return request(this.http.get<ObjectiveTreeResponse>(`${this.url}/bff/objective-tree`));
  }

  /** POST /v2/objectives (createObjective). */
  createObjective(body: CreateObjectiveBody): Promise<ObjectiveEntity> {
    return request(this.http.post<ObjectiveEntity>(`${this.url}/objectives`, body));
  }

  /** POST /v2/objectives/{objectiveId}/sub-objectives (addSubObjective) : une étape sous un objectif ou une étape. */
  addSubObjective(objectiveId: string, body: AddSubObjectiveBody): Promise<ObjectiveEntity> {
    return request(this.http.post<ObjectiveEntity>(`${this.objective(objectiveId)}/sub-objectives`, body));
  }

  /** POST /v2/objectives/{objectiveId}/tasks (addTaskToObjective) : un pas sur un objectif ou une étape. */
  addTaskToObjective(objectiveId: string, body: AddTaskBody): Promise<TaskEntity> {
    return request(this.http.post<TaskEntity>(`${this.objective(objectiveId)}/tasks`, body));
  }

  /** PATCH /v2/objectives/{objectiveId}/rename (renameObjective). */
  renameObjective(objectiveId: string, title: string): Promise<ObjectiveEntity> {
    return request(this.http.patch<ObjectiveEntity>(`${this.objective(objectiveId)}/rename`, { title }));
  }

  /** PATCH /v2/objectives/{objectiveId}/clarify (clarifyObjective) : un champ absent reste inchangé, `""` le vide. */
  clarifyObjective(objectiveId: string, body: ClarifyObjectiveBody): Promise<ObjectiveEntity> {
    return request(this.http.patch<ObjectiveEntity>(`${this.objective(objectiveId)}/clarify`, body));
  }

  /** PATCH /v2/objectives/{objectiveId}/set-deadline (setObjectiveDeadline). `dueDate` : une date ou un instant ISO 8601. */
  setObjectiveDeadline(objectiveId: string, dueDate: string): Promise<ObjectiveEntity> {
    return request(this.http.patch<ObjectiveEntity>(`${this.objective(objectiveId)}/set-deadline`, { dueDate }));
  }

  /** PATCH /v2/objectives/{objectiveId}/remove-deadline (removeObjectiveDeadline). */
  removeObjectiveDeadline(objectiveId: string): Promise<ObjectiveEntity> {
    return request(this.http.patch<ObjectiveEntity>(`${this.objective(objectiveId)}/remove-deadline`, {}));
  }

  /**
   * DELETE /v2/objectives/{objectiveId} (deleteObjective) : un objectif ou une étape, avec tout ce qui en dépend
   * (ses étapes, leurs pas et, pour un objectif, sa conversation avec Akari). Définitif : l'API n'a pas de
   * corbeille. Un objectif déjà effacé répond OBJECTIVE_NOT_FOUND.
   */
  deleteObjective(objectiveId: string): Promise<void> {
    return request(this.http.delete<void>(this.objective(objectiveId)));
  }

  /** PATCH /v2/tasks/{taskId}/rename (renameTask). */
  renameTask(taskId: string, title: string): Promise<TaskEntity> {
    return request(this.http.patch<TaskEntity>(`${this.task(taskId)}/rename`, { title }));
  }

  /** PATCH /v2/tasks/{taskId}/reprioritize (reprioritizeTask) : l'importance et l'urgence. */
  reprioritizeTask(taskId: string, importance: number, urgency: number): Promise<TaskEntity> {
    return request(this.http.patch<TaskEntity>(`${this.task(taskId)}/reprioritize`, { importance, urgency }));
  }

  /** PATCH /v2/tasks/{taskId}/move (moveTask) : vers une autre étape, un objectif, un ancêtre. */
  moveTask(taskId: string, objectiveId: string): Promise<TaskEntity> {
    return request(this.http.patch<TaskEntity>(`${this.task(taskId)}/move`, { objectiveId }));
  }

  /** PATCH /v2/tasks/{taskId}/complete (completeTask) : cocher un pas. */
  completeTask(taskId: string): Promise<TaskEntity> {
    return request(this.http.patch<TaskEntity>(`${this.task(taskId)}/complete`, {}));
  }

  /** PATCH /v2/tasks/{taskId}/reopen (reopenTask) : décocher un pas. */
  reopenTask(taskId: string): Promise<TaskEntity> {
    return request(this.http.patch<TaskEntity>(`${this.task(taskId)}/reopen`, {}));
  }

  /** DELETE /v2/tasks/{taskId} (deleteTask) : un pas, pour de bon. Un pas déjà effacé répond TASK_NOT_FOUND. */
  deleteTask(taskId: string): Promise<void> {
    return request(this.http.delete<void>(this.task(taskId)));
  }
}
