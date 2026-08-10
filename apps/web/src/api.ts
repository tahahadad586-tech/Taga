import type { Workflow, WorkflowRun, NodeDefinition, ValidationIssue } from '@taga/shared';

const TOKEN_KEY = 'taga_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const response = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers ?? {})
    }
  });
  if (response.status === 401) {
    setToken(null);
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string; issues?: string[] };
    throw new Error(body.issues?.join('؛ ') ?? body.error ?? `Request failed (${response.status})`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  register: (email: string, password: string, name: string) =>
    request<{ token: string }>('/api/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name }) }),
  login: (email: string, password: string) =>
    request<{ token: string }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  catalog: () => request<NodeDefinition[]>('/api/catalog'),
  listWorkflows: () => request<Workflow[]>('/api/workflows'),
  createWorkflow: (name: string) => request<Workflow>('/api/workflows', { method: 'POST', body: JSON.stringify({ name }) }),
  getWorkflow: (id: string) => request<Workflow>(`/api/workflows/${id}`),
  updateWorkflow: (id: string, data: Partial<Workflow>) =>
    request<Workflow>(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteWorkflow: (id: string) => request<void>(`/api/workflows/${id}`, { method: 'DELETE' }),
  validateWorkflow: (id: string, graph: Workflow['graph']) =>
    request<ValidationIssue[]>(`/api/workflows/${id}/validate`, { method: 'POST', body: JSON.stringify({ graph }) }),
  runWorkflow: (id: string, input: Record<string, unknown> = {}) =>
    request<{ runId: string }>(`/api/workflows/${id}/run`, { method: 'POST', body: JSON.stringify({ input }) }),
  getRun: (runId: string) => request<WorkflowRun>(`/api/runs/${runId}`),
  listRuns: (workflowId: string) => request<WorkflowRun[]>(`/api/workflows/${workflowId}/runs`),
  listVersions: (workflowId: string) => request<{ version: number; createdAt: string }[]>(`/api/workflows/${workflowId}/versions`)
};
