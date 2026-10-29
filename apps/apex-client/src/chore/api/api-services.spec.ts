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
    expect(isApiRequest('https://api.test/v1/objectives', API)).toBe(true);
    expect(isApiRequest('https://api.test', API)).toBe(true);
    expect(isApiRequest('https://api.test.ailleurs.test/v1', API)).toBe(false);
    expect(isApiRequest('https://ailleurs.test/v1', API)).toBe(false);
  });
});

describe('ObjectivesApi', () => {
  it.each([
    ['list', () => [], 'GET', '/v1/objectives', null],
    ['create', () => [{ title: 'Guitare', dueDate: '2027-05-01T00:00:00.000Z' }], 'POST', '/v1/objectives', { title: 'Guitare', dueDate: '2027-05-01T00:00:00.000Z' }],
    ['edit', () => ['semi', { title: 'Semi', dueDate: null }], 'PATCH', '/v1/objectives/semi', { title: 'Semi', dueDate: null }],
    ['addSubObjective', () => ['semi', { title: 'Endurance' }], 'POST', '/v1/objectives/semi/sub-objectives', { title: 'Endurance' }],
    ['addTask', () => ['endurance', { title: 'Courir', importance: 3, urgency: 2 }], 'POST', '/v1/objectives/endurance/tasks', { title: 'Courir', importance: 3, urgency: 2 }],
    ['editTask', () => ['t1', { title: 'Courir', objectiveId: 'semi', importance: 4, urgency: 1 }], 'PATCH', '/v1/tasks/t1', { title: 'Courir', objectiveId: 'semi', importance: 4, urgency: 1 }],
    ['setTaskDone', () => ['t1', true], 'PUT', '/v1/tasks/t1/done', { done: true }],
  ] as const)('%s → %s %s', async (method, args, verb, path, body) => {
    const { httpMock, objectives } = setup();
    const call = (objectives[method] as (...values: unknown[]) => Promise<unknown>).apply(objectives, [...args()]);

    const request = httpMock.expectOne(`${API}${path}`);
    expect(request.request.method).toBe(verb);
    expect(request.request.body).toEqual(body);
    request.flush({ ok: method });
    await expect(call).resolves.toEqual({ ok: method });
  });

  it('encode les identifiants dans l’adresse', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.setTaskDone('a/b?c', false);
    httpMock.expectOne(`${API}/v1/tasks/a%2Fb%3Fc/done`).flush({ id: 'a/b?c', title: 'x', done: false });
    await call;
  });

  it('un refus de l’API devient une ApiError avec son code', async () => {
    const { httpMock, objectives } = setup();
    const call = objectives.editTask('t1', { title: 'Courir', objectiveId: 'semi', importance: 4, urgency: 1 });
    httpMock
      .expectOne(`${API}/v1/tasks/t1`)
      .flush({ error: { code: 'TASK_NOT_FOUND', message: 'Task with ID t1 not found' } }, { status: 404, statusText: 'Not Found' });

    const error = await call.catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'TASK_NOT_FOUND', status: 404 });
  });
});

describe('AssistantApi', () => {
  it.each([
    ['conversation', () => ['semi'], 'GET', '/v1/objectives/semi/conversation', null],
    ['state', () => ['semi'], 'GET', '/v1/objectives/semi/assistant', null],
    ['sendMessage', () => ['semi', 'On commence ?'], 'POST', '/v1/objectives/semi/assistant/messages', { message: 'On commence ?' }],
    ['respondToPermission', () => ['semi', true, 'call-1'], 'POST', '/v1/objectives/semi/assistant/permission', { granted: true, toolCallId: 'call-1' }],
    ['respondToPermission', () => ['semi', false], 'POST', '/v1/objectives/semi/assistant/permission', { granted: false }],
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
    ['login', 'POST', '/v1/auth/login'],
    ['register', 'POST', '/v1/auth/register'],
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
      .expectOne(`${API}/v1/auth/login`)
      .flush({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' } }, { status: 401, statusText: 'Unauthorized' });
    await expect(call).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS', status: 401 });
  });
});
