import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_URL, isApiRequest, normalizeApiUrl } from './api.config';
import { ApiError } from './api-error';
import { AssistantApi } from './assistant.api';
import { AuthApi } from './auth.api';
import { ObjectivesApi } from './objectives.api';

/*
 * Les services de l'API : chaque méthode appelle sa route (méthode, adresse, corps) du contrat d'Apex Brain
 * (docs/api.md), rend la réponse telle quelle, et transforme un refus en ApiError.
 */

const API = 'https://api.test';

let httpMock: HttpTestingController | undefined;

function setup() {
  TestBed.configureTestingModule({
    providers: [{ provide: API_URL, useValue: API }, provideHttpClient(), provideHttpClientTesting()],
  });
  httpMock = TestBed.inject(HttpTestingController);
  return {
    httpMock,
    objectives: TestBed.inject(ObjectivesApi),
    assistant: TestBed.inject(AssistantApi),
    auth: TestBed.inject(AuthApi),
  };
}

afterEach(() => {
  httpMock?.verify();
  httpMock = undefined;
  TestBed.resetTestingModule();
});

describe('api.config', () => {
  it('normalise l’adresse et ne reconnaît que les requêtes vers l’API', () => {
    expect(normalizeApiUrl(' https://apex-brain.test/// ')).toBe('https://apex-brain.test');
    expect(isApiRequest('https://api.test/v2/objectives', API)).toBe(true);
    expect(isApiRequest('https://api.test', API)).toBe(true);
    expect(isApiRequest('https://api.test.ailleurs.test/v2', API)).toBe(false);
    expect(isApiRequest('https://ailleurs.test/v2', API)).toBe(false);
  });
});

describe('ObjectivesApi', () => {
  it.each([
    ['objectiveTree', () => [], 'GET', '/v2/bff/objective-tree', null],
    ['createObjective', () => [{ title: 'Guitare', dueDate: '2027-05-01T00:00:00.000Z' }], 'POST', '/v2/objectives', { title: 'Guitare', dueDate: '2027-05-01T00:00:00.000Z' }],
    ['addSubObjective', () => ['semi', { title: 'Endurance' }], 'POST', '/v2/objectives/semi/sub-objectives', { title: 'Endurance' }],
    ['addTaskToObjective', () => ['endurance', { title: 'Courir', importance: 3, urgency: 2 }], 'POST', '/v2/objectives/endurance/tasks', { title: 'Courir', importance: 3, urgency: 2 }],
    ['renameObjective', () => ['semi', 'Semi'], 'PATCH', '/v2/objectives/semi/rename', { title: 'Semi' }],
    ['clarifyObjective', () => ['semi', { why: '' }], 'PATCH', '/v2/objectives/semi/clarify', { why: '' }],
    ['setObjectiveDeadline', () => ['semi', '2027-04-01T00:00:00.000Z'], 'PATCH', '/v2/objectives/semi/set-deadline', { dueDate: '2027-04-01T00:00:00.000Z' }],
    ['removeObjectiveDeadline', () => ['semi'], 'PATCH', '/v2/objectives/semi/remove-deadline', {}],
    ['deleteObjective', () => ['endurance'], 'DELETE', '/v2/objectives/endurance', null],
    ['renameTask', () => ['t1', 'Courir'], 'PATCH', '/v2/tasks/t1/rename', { title: 'Courir' }],
    ['reprioritizeTask', () => ['t1', 4, 1], 'PATCH', '/v2/tasks/t1/reprioritize', { importance: 4, urgency: 1 }],
    ['moveTask', () => ['t1', 'semi'], 'PATCH', '/v2/tasks/t1/move', { objectiveId: 'semi' }],
    ['completeTask', () => ['t1'], 'PATCH', '/v2/tasks/t1/complete', {}],
    ['reopenTask', () => ['t1'], 'PATCH', '/v2/tasks/t1/reopen', {}],
    ['deleteTask', () => ['t1'], 'DELETE', '/v2/tasks/t1', null],
  ] as const)('%s → %s %s', async (method, args, verb, path, body) => {
    const { httpMock, objectives } = setup();
    const call = (objectives[method] as (...values: unknown[]) => Promise<unknown>).apply(objectives, [...args()]);

    const request = httpMock.expectOne(`${API}${path}`);
    expect(request.request.method).toBe(verb);
    expect(request.request.body).toEqual(body);
    request.flush({ ok: method });
    await expect(call).resolves.toEqual({ ok: method });
  });

  it('un effacement rend une réponse vide (204)', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.deleteTask('t1');
    httpMock.expectOne(`${API}/v2/tasks/t1`).flush(null, { status: 204, statusText: 'No Content' });
    await expect(call).resolves.toBeNull();
  });

  it('un objectif déjà effacé répond OBJECTIVE_NOT_FOUND', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.deleteObjective('semi');
    httpMock
      .expectOne(`${API}/v2/objectives/semi`)
      .flush({ error: { code: 'OBJECTIVE_NOT_FOUND', message: 'Objective with ID semi not found' } }, { status: 404, statusText: 'Not Found' });
    await expect(call).rejects.toMatchObject({ code: 'OBJECTIVE_NOT_FOUND', status: 404 });
  });

  it('encode les identifiants dans l’adresse', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.reopenTask('a/b?c');
    httpMock.expectOne(`${API}/v2/tasks/a%2Fb%3Fc/reopen`).flush({ id: 'a/b?c', title: 'x', done: false });
    await call;
  });

  it('un refus de l’API devient une ApiError avec son code', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.renameTask('t1', 'Courir');
    httpMock
      .expectOne(`${API}/v2/tasks/t1/rename`)
      .flush({ error: { code: 'TASK_NOT_FOUND', message: 'Task with ID t1 not found' } }, { status: 404, statusText: 'Not Found' });

    const error = await call.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'TASK_NOT_FOUND', status: 404 });
  });
});

describe('AssistantApi', () => {
  it.each([
    ['conversation', () => ['semi'], 'GET', '/v2/objectives/semi/conversation', null],
    ['state', () => ['semi'], 'GET', '/v2/objectives/semi/assistant', null],
    ['sendMessage', () => ['semi', 'On commence ?'], 'POST', '/v2/objectives/semi/assistant/messages', { message: 'On commence ?' }],
    ['respondToPermission', () => ['semi', true, 'call-1'], 'POST', '/v2/objectives/semi/assistant/permission', { granted: true, toolCallId: 'call-1' }],
    ['respondToPermission', () => ['semi', false], 'POST', '/v2/objectives/semi/assistant/permission', { granted: false }],
  ] as const)('%s → %s %s', async (method, args, verb, path, body) => {
    const { httpMock, assistant } = setup();
    const call = (assistant[method] as (...values: unknown[]) => Promise<unknown>).apply(assistant, [...args()]);

    const request = httpMock.expectOne(`${API}${path}`);
    expect(request.request.method).toBe(verb);
    expect(request.request.body).toEqual(body);
    request.flush({ ok: method });
    await expect(call).resolves.toEqual({ ok: method });
  });
});

describe('AuthApi', () => {
  it.each([
    ['login', 'POST', '/v2/auth/login'],
    ['register', 'POST', '/v2/auth/register'],
  ] as const)('%s → %s %s', async (method, verb, path) => {
    const { httpMock, auth } = setup();
    const credentials = { email: 'lea@exemple.com', password: 'secret1' };
    const call = auth[method](credentials);

    const request = httpMock.expectOne(`${API}${path}`);
    expect(request.request.method).toBe(verb);
    expect(request.request.body).toEqual(credentials);
    request.flush({ user: { id: 'u1', name: 'Léa', email: 'lea@exemple.com' }, session: null });
    await expect(call).resolves.toMatchObject({ user: { id: 'u1' } });
  });

  it('des identifiants refusés donnent INVALID_CREDENTIALS', async () => {
    const { httpMock, auth } = setup();
    const call = auth.login({ email: 'lea@exemple.com', password: 'faux' });
    httpMock
      .expectOne(`${API}/v2/auth/login`)
      .flush({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });
});
