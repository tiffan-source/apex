import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { API_URL } from './api.config';
import { request } from './api-error';
import type {
  AddSubObjectiveBody,
  AddTaskBody,
  CreatedTaskResponse,
  CreateObjectiveBody,
  EditedTaskResponse,
  EditObjectiveBody,
  EditTaskBody,
  ObjectiveResponse,
  ObjectivesResponse,
  SubObjectiveResponse,
  TaskDoneResponse,
} from './api.models';

/**
 * Les objectifs, les étapes et les pas, par l'API : chaque méthode est une route, et la règle métier est
 * appliquée par le serveur. Un échec devient une ApiError (OBJECTIVE_NOT_FOUND, TASK_NOT_FOUND,
 * FAIL_TO_SAVE_OBJECTIVE, VALIDATION_ERROR…), dont les stores tirent leur phrase.
 */
@Injectable({ providedIn: 'root' })
export class ObjectivesApi {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/v1`;

  private objective(objectiveId: string): string {
    return `${this.url}/objectives/${encodeURIComponent(objectiveId)}`;
  }

  private task(taskId: string): string {
    return `${this.url}/tasks/${encodeURIComponent(taskId)}`;
  }

  /** GET /v1/objectives : tous les objectifs, étapes et pas de la personne, à plat. */
  list(): Promise<ObjectivesResponse> {
    return request(this.http.get<ObjectivesResponse>(`${this.url}/objectives`));
  }

  /** POST /v1/objectives */
  create(body: CreateObjectiveBody): Promise<ObjectiveResponse> {
    return request(this.http.post<ObjectiveResponse>(`${this.url}/objectives`, body));
  }

  /** PATCH /v1/objectives/{objectiveId} : un objectif ou une étape ; un champ absent reste inchangé. */
  edit(objectiveId: string, body: EditObjectiveBody): Promise<ObjectiveResponse> {
    return request(this.http.patch<ObjectiveResponse>(this.objective(objectiveId), body));
  }

  /** POST /v1/objectives/{objectiveId}/sub-objectives : une étape sous un objectif ou une étape. */
  addSubObjective(objectiveId: string, body: AddSubObjectiveBody): Promise<SubObjectiveResponse> {
    return request(this.http.post<SubObjectiveResponse>(`${this.objective(objectiveId)}/sub-objectives`, body));
  }

  /** POST /v1/objectives/{objectiveId}/tasks : un pas sur un objectif ou une étape. */
  addTask(objectiveId: string, body: AddTaskBody): Promise<CreatedTaskResponse> {
    return request(this.http.post<CreatedTaskResponse>(`${this.objective(objectiveId)}/tasks`, body));
  }

  /** PATCH /v1/tasks/{taskId} : modifier un pas, ou le déplacer en changeant `objectiveId`. */
  editTask(taskId: string, body: EditTaskBody): Promise<EditedTaskResponse> {
    return request(this.http.patch<EditedTaskResponse>(this.task(taskId), body));
  }

  /** PUT /v1/tasks/{taskId}/done : cocher ou décocher un pas. */
  setTaskDone(taskId: string, done: boolean): Promise<TaskDoneResponse> {
    return request(this.http.put<TaskDoneResponse>(`${this.task(taskId)}/done`, { done }));
  }
}
