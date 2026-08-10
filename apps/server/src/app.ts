import express, { type Express, type Response } from 'express';
import cors from 'cors';
import type Database from 'better-sqlite3';
import { NODE_CATALOG } from '@taga/shared';
import { validateGraph } from '@taga/engine';
import { createAuthRouter, requireAuth, type AuthedRequest } from './auth.js';
import { WorkflowService } from './workflows.js';
import { Scheduler } from './scheduler.js';

/** Simple fixed-window per-IP rate limiter. */
function rateLimit(maxPerMinute: number) {
  const hits = new Map<string, { count: number; windowStart: number }>();
  return (req: AuthedRequest, res: Response, next: () => void) => {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || now - entry.windowStart > 60_000) {
      hits.set(key, { count: 1, windowStart: now });
      next();
      return;
    }
    entry.count += 1;
    if (entry.count > maxPerMinute) {
      res.status(429).json({ error: 'Too many requests, slow down' });
      return;
    }
    next();
  };
}

export function createApp(db: Database.Database): { app: Express; scheduler: Scheduler } {
  const app = express();
  const workflows = new WorkflowService(db);
  const scheduler = new Scheduler(db, workflows);

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(rateLimit(300));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, name: 'Taga', version: '0.1.0' });
  });

  app.get('/api/catalog', (_req, res) => {
    res.json(NODE_CATALOG);
  });

  app.use('/api/auth', rateLimit(30), createAuthRouter(db));

  // --- Workflows CRUD ---
  app.get('/api/workflows', requireAuth, (req: AuthedRequest, res) => {
    res.json(workflows.list(req.userId!));
  });

  app.post('/api/workflows', requireAuth, (req: AuthedRequest, res) => {
    const { name, description, graph, trigger } = req.body ?? {};
    if (typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Workflow name is required' });
      return;
    }
    const workflow = workflows.create(req.userId!, { name: name.trim(), description, graph, trigger });
    scheduler.sync(workflow.id);
    res.status(201).json(workflow);
  });

  app.get('/api/workflows/:id', requireAuth, (req: AuthedRequest, res) => {
    const workflow = workflows.get(req.userId!, req.params.id);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflow);
  });

  app.put('/api/workflows/:id', requireAuth, (req: AuthedRequest, res) => {
    const { name, description, graph, trigger } = req.body ?? {};
    const workflow = workflows.update(req.userId!, req.params.id, { name, description, graph, trigger });
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    scheduler.sync(workflow.id);
    res.json(workflow);
  });

  app.delete('/api/workflows/:id', requireAuth, (req: AuthedRequest, res) => {
    if (!workflows.remove(req.userId!, req.params.id)) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    scheduler.sync(req.params.id);
    res.status(204).end();
  });

  app.get('/api/workflows/:id/versions', requireAuth, (req: AuthedRequest, res) => {
    res.json(workflows.listVersions(req.userId!, req.params.id));
  });

  // --- Validation ---
  app.post('/api/workflows/:id/validate', requireAuth, (req: AuthedRequest, res) => {
    const workflow = workflows.get(req.userId!, req.params.id);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    const graph = req.body?.graph ?? workflow.graph;
    res.json(validateGraph(graph));
  });

  // --- Runs ---
  app.post('/api/workflows/:id/run', requireAuth, (req: AuthedRequest, res) => {
    const workflow = workflows.get(req.userId!, req.params.id);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    const input = (req.body?.input ?? {}) as Record<string, unknown>;
    const { runId, issues } = workflows.startRun(workflow, 'manual', input);
    if (issues) {
      res.status(422).json({ error: 'Workflow validation failed', issues });
      return;
    }
    res.status(202).json({ runId });
  });

  app.get('/api/workflows/:id/runs', requireAuth, (req: AuthedRequest, res) => {
    const workflow = workflows.get(req.userId!, req.params.id);
    if (!workflow) {
      res.status(404).json({ error: 'Workflow not found' });
      return;
    }
    res.json(workflows.listRuns(workflow.id));
  });

  app.get('/api/runs/:runId', requireAuth, (req: AuthedRequest, res) => {
    const run = workflows.getRun(req.params.runId);
    if (!run || !workflows.get(req.userId!, run.workflowId)) {
      res.status(404).json({ error: 'Run not found' });
      return;
    }
    res.json(run);
  });

  // --- Webhook trigger (public, no auth: the workflow id acts as the secret path) ---
  app.post('/api/hooks/:workflowId', rateLimit(60), (req, res) => {
    const workflow = workflows.getAnyOwner(req.params.workflowId);
    if (!workflow || workflow.trigger.type !== 'webhook') {
      res.status(404).json({ error: 'Webhook not found' });
      return;
    }
    const { runId, issues } = workflows.startRun(workflow, 'webhook', (req.body ?? {}) as Record<string, unknown>);
    if (issues) {
      res.status(422).json({ error: 'Workflow validation failed', issues });
      return;
    }
    res.status(202).json({ runId });
  });

  return { app, scheduler };
}
