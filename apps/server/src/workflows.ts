import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { NodeRunLog, TriggerType, Workflow, WorkflowGraph, WorkflowRun, WorkflowTrigger } from '@taga/shared';
import { createDefaultHandlers, executeWorkflow, validateGraph } from '@taga/engine';

interface WorkflowRow {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  graph: string;
  trigger: string;
  version: number;
  created_at: string;
  updated_at: string;
}

interface RunRow {
  id: string;
  workflow_id: string;
  status: string;
  trigger_type: string;
  input: string;
  output: string | null;
  logs: string;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

export function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    graph: JSON.parse(row.graph) as WorkflowGraph,
    trigger: JSON.parse(row.trigger) as WorkflowTrigger,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export function rowToRun(row: RunRow): WorkflowRun {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status as WorkflowRun['status'],
    triggerType: row.trigger_type as TriggerType,
    input: JSON.parse(row.input) as Record<string, unknown>,
    output: row.output ? (JSON.parse(row.output) as Record<string, unknown>) : null,
    logs: JSON.parse(row.logs) as NodeRunLog[],
    error: row.error ?? undefined,
    startedAt: row.started_at,
    finishedAt: row.finished_at ?? undefined
  };
}

export class WorkflowService {
  constructor(private readonly db: Database.Database) {}

  list(userId: string): Workflow[] {
    const rows = this.db
      .prepare('SELECT * FROM workflows WHERE user_id = ? ORDER BY updated_at DESC')
      .all(userId) as WorkflowRow[];
    return rows.map(rowToWorkflow);
  }

  get(userId: string, id: string): Workflow | undefined {
    const row = this.db.prepare('SELECT * FROM workflows WHERE id = ? AND user_id = ?').get(id, userId) as
      | WorkflowRow
      | undefined;
    return row ? rowToWorkflow(row) : undefined;
  }

  getAnyOwner(id: string): (Workflow & { userId: string }) | undefined {
    const row = this.db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
    return row ? { ...rowToWorkflow(row), userId: row.user_id } : undefined;
  }

  create(userId: string, data: { name: string; description?: string; graph?: WorkflowGraph; trigger?: WorkflowTrigger }): Workflow {
    const id = randomUUID();
    const now = new Date().toISOString();
    const graph: WorkflowGraph = data.graph ?? { nodes: [], edges: [] };
    const trigger: WorkflowTrigger = data.trigger ?? { type: 'manual' };
    this.db
      .prepare(
        'INSERT INTO workflows (id, user_id, name, description, graph, trigger, version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)'
      )
      .run(id, userId, data.name, data.description ?? null, JSON.stringify(graph), JSON.stringify(trigger), now, now);
    return this.get(userId, id)!;
  }

  /** Saves the workflow, bumping the version and archiving the previous one. */
  update(
    userId: string,
    id: string,
    data: { name?: string; description?: string; graph?: WorkflowGraph; trigger?: WorkflowTrigger }
  ): Workflow | undefined {
    const current = this.get(userId, id);
    if (!current) return undefined;
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO workflow_versions (id, workflow_id, version, graph, trigger, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(randomUUID(), id, current.version, JSON.stringify(current.graph), JSON.stringify(current.trigger), now);
    this.db
      .prepare('UPDATE workflows SET name = ?, description = ?, graph = ?, trigger = ?, version = version + 1, updated_at = ? WHERE id = ?')
      .run(
        data.name ?? current.name,
        data.description ?? current.description ?? null,
        JSON.stringify(data.graph ?? current.graph),
        JSON.stringify(data.trigger ?? current.trigger),
        now,
        id
      );
    return this.get(userId, id);
  }

  remove(userId: string, id: string): boolean {
    const existing = this.get(userId, id);
    if (!existing) return false;
    this.db.prepare('DELETE FROM runs WHERE workflow_id = ?').run(id);
    this.db.prepare('DELETE FROM workflow_versions WHERE workflow_id = ?').run(id);
    this.db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
    return true;
  }

  listVersions(userId: string, id: string): { version: number; createdAt: string }[] {
    if (!this.get(userId, id)) return [];
    const rows = this.db
      .prepare('SELECT version, created_at FROM workflow_versions WHERE workflow_id = ? ORDER BY version DESC')
      .all(id) as { version: number; created_at: string }[];
    return rows.map((r) => ({ version: r.version, createdAt: r.created_at }));
  }

  listRuns(workflowId: string): WorkflowRun[] {
    const rows = this.db
      .prepare('SELECT * FROM runs WHERE workflow_id = ? ORDER BY started_at DESC LIMIT 50')
      .all(workflowId) as RunRow[];
    return rows.map(rowToRun);
  }

  getRun(runId: string): WorkflowRun | undefined {
    const row = this.db.prepare('SELECT * FROM runs WHERE id = ?').get(runId) as RunRow | undefined;
    return row ? rowToRun(row) : undefined;
  }

  /**
   * Queues and executes a workflow run asynchronously. Returns the run id
   * immediately; status and per-node logs are persisted as execution proceeds.
   */
  startRun(workflow: Workflow, triggerType: TriggerType, input: Record<string, unknown>): { runId: string; issues?: string[] } {
    const issues = validateGraph(workflow.graph).filter((i) => i.level === 'error');
    if (issues.length > 0) {
      return { runId: '', issues: issues.map((i) => i.message) };
    }
    const runId = randomUUID();
    const now = new Date().toISOString();
    this.db
      .prepare('INSERT INTO runs (id, workflow_id, status, trigger_type, input, logs, started_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(runId, workflow.id, 'running', triggerType, JSON.stringify(input), '[]', now);

    const handlers = createDefaultHandlers({
      llmApiKey: process.env.TAGA_LLM_API_KEY,
      devMode: process.env.NODE_ENV !== 'production'
    });

    void executeWorkflow(workflow.graph, handlers, {
      runInput: input,
      onNodeFinished: (log) => {
        const row = this.db.prepare('SELECT logs FROM runs WHERE id = ?').get(runId) as { logs: string } | undefined;
        if (!row) return;
        const logs = JSON.parse(row.logs) as NodeRunLog[];
        logs.push(log);
        this.db.prepare('UPDATE runs SET logs = ? WHERE id = ?').run(JSON.stringify(logs), runId);
      }
    })
      .then((result) => {
        this.db
          .prepare('UPDATE runs SET status = ?, output = ?, error = ?, finished_at = ? WHERE id = ?')
          .run(result.status, JSON.stringify(result.output), result.error ?? null, new Date().toISOString(), runId);
      })
      .catch((err: unknown) => {
        this.db
          .prepare('UPDATE runs SET status = ?, error = ?, finished_at = ? WHERE id = ?')
          .run('failed', err instanceof Error ? err.message : String(err), new Date().toISOString(), runId);
      });

    return { runId };
  }
}
