import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { createDb } from './db.js';
import { createApp } from './app.js';

let server: Server;
let baseUrl: string;
let token: string;

async function api(path: string, options: RequestInit = {}): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers ?? {})
    }
  });
}

beforeAll(async () => {
  const db = createDb(':memory:');
  const { app } = createApp(db);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const address = server.address();
  if (typeof address === 'object' && address) baseUrl = `http://127.0.0.1:${address.port}`;
});

afterAll(() => {
  server.close();
});

describe('API', () => {
  it('serves health and node catalog', async () => {
    const health = await api('/api/health');
    expect(health.status).toBe(200);
    const catalog = (await (await api('/api/catalog')).json()) as unknown[];
    expect(catalog.length).toBeGreaterThan(5);
  });

  it('registers and logs in a user', async () => {
    const register = await api('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@taga.dev', password: 'password123', name: 'Tester' })
    });
    expect(register.status).toBe(201);
    const data = (await register.json()) as { token: string };
    token = data.token;
    expect(token).toBeTruthy();

    const login = await api('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@taga.dev', password: 'password123' })
    });
    expect(login.status).toBe(200);
  });

  it('rejects unauthenticated workflow access', async () => {
    const saved = token;
    token = '';
    const response = await api('/api/workflows');
    expect(response.status).toBe(401);
    token = saved;
  });

  let workflowId: string;

  it('creates, updates (with versioning) and lists workflows', async () => {
    const create = await api('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({ name: 'My Flow' })
    });
    expect(create.status).toBe(201);
    const workflow = (await create.json()) as { id: string; version: number };
    workflowId = workflow.id;
    expect(workflow.version).toBe(1);

    const graph = {
      nodes: [
        { id: 'a', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'hi' } },
        { id: 'b', type: 'output.log', position: { x: 200, y: 0 }, params: {} }
      ],
      edges: [{ id: 'e1', source: 'a', sourceHandle: 'text', target: 'b', targetHandle: 'value' }]
    };
    const update = await api(`/api/workflows/${workflowId}`, {
      method: 'PUT',
      body: JSON.stringify({ graph })
    });
    expect(update.status).toBe(200);
    const updated = (await update.json()) as { version: number };
    expect(updated.version).toBe(2);

    const versions = (await (await api(`/api/workflows/${workflowId}/versions`)).json()) as unknown[];
    expect(versions).toHaveLength(1);

    const list = (await (await api('/api/workflows')).json()) as unknown[];
    expect(list).toHaveLength(1);
  });

  it('validates and runs a workflow, exposing per-node logs', async () => {
    const validation = (await (
      await api(`/api/workflows/${workflowId}/validate`, { method: 'POST', body: '{}' })
    ).json()) as { level: string }[];
    expect(validation.filter((i) => i.level === 'error')).toHaveLength(0);

    const run = await api(`/api/workflows/${workflowId}/run`, { method: 'POST', body: '{}' });
    expect(run.status).toBe(202);
    const { runId } = (await run.json()) as { runId: string };

    let status = 'running';
    let details: { status: string; logs: unknown[]; output: unknown } | undefined;
    for (let i = 0; i < 50 && status === 'running'; i++) {
      await new Promise((r) => setTimeout(r, 50));
      details = (await (await api(`/api/runs/${runId}`)).json()) as typeof details;
      status = details!.status;
    }
    expect(status).toBe('succeeded');
    expect(details!.logs).toHaveLength(2);
  });

  it('triggers a webhook workflow without auth', async () => {
    const create = await api('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Hook Flow',
        trigger: { type: 'webhook' },
        graph: {
          nodes: [
            { id: 'hook', type: 'trigger.webhook', position: { x: 0, y: 0 }, params: {} },
            { id: 'log', type: 'output.log', position: { x: 200, y: 0 }, params: {} }
          ],
          edges: [{ id: 'e1', source: 'hook', sourceHandle: 'payload', target: 'log', targetHandle: 'value' }]
        }
      })
    });
    const { id } = (await create.json()) as { id: string };

    const saved = token;
    token = '';
    const hook = await api(`/api/hooks/${id}`, { method: 'POST', body: JSON.stringify({ ping: 'pong' }) });
    token = saved;
    expect(hook.status).toBe(202);
  });

  it('rejects runs of invalid workflows', async () => {
    const create = await api('/api/workflows', {
      method: 'POST',
      body: JSON.stringify({ name: 'Empty Flow' })
    });
    const { id } = (await create.json()) as { id: string };
    const run = await api(`/api/workflows/${id}/run`, { method: 'POST', body: '{}' });
    expect(run.status).toBe(422);
  });
});
