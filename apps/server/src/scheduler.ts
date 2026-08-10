import cron, { type ScheduledTask } from 'node-cron';
import type Database from 'better-sqlite3';
import type { WorkflowService } from './workflows.js';
import { rowToWorkflow } from './workflows.js';

/**
 * Registers cron-scheduled workflows and keeps registrations in sync when
 * workflows are saved.
 */
export class Scheduler {
  private tasks = new Map<string, ScheduledTask>();

  constructor(
    private readonly db: Database.Database,
    private readonly workflows: WorkflowService
  ) {}

  loadAll(): void {
    const rows = this.db.prepare('SELECT * FROM workflows').all() as Parameters<typeof rowToWorkflow>[0][];
    for (const row of rows) this.sync(row.id);
  }

  sync(workflowId: string): void {
    this.tasks.get(workflowId)?.stop();
    this.tasks.delete(workflowId);
    const workflow = this.workflows.getAnyOwner(workflowId);
    if (!workflow || workflow.trigger.type !== 'schedule' || !workflow.trigger.cron) return;
    if (!cron.validate(workflow.trigger.cron)) return;
    const task = cron.schedule(workflow.trigger.cron, () => {
      const latest = this.workflows.getAnyOwner(workflowId);
      if (latest) this.workflows.startRun(latest, 'schedule', {});
    });
    this.tasks.set(workflowId, task);
  }

  stopAll(): void {
    for (const task of this.tasks.values()) task.stop();
    this.tasks.clear();
  }
}
