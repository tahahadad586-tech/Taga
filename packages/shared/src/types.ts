/** Core workflow data model shared between the editor, API and engine. */

export type NodeCategory = 'input' | 'ai' | 'web' | 'logic' | 'integration' | 'output';

export interface ParamDefinition {
  key: string;
  label: string;
  labelAr: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'text' | 'json';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  default?: unknown;
}

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  /** Named inputs this node accepts from upstream nodes. */
  inputs: string[];
  /** Named outputs this node produces. */
  outputs: string[];
  params: ParamDefinition[];
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  params: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  /** Output handle on the source node. */
  sourceHandle?: string;
  target: string;
  /** Input handle on the target node. */
  targetHandle?: string;
}

export type TriggerType = 'manual' | 'webhook' | 'schedule';

export interface WorkflowTrigger {
  type: TriggerType;
  /** Cron expression when type === 'schedule'. */
  cron?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  graph: WorkflowGraph;
  trigger: WorkflowTrigger;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type RunStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export interface NodeRunLog {
  nodeId: string;
  nodeType: string;
  status: 'succeeded' | 'failed' | 'skipped';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error?: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  attempts: number;
}

export interface WorkflowRun {
  id: string;
  workflowId: string;
  status: RunStatus;
  triggerType: TriggerType;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  logs: NodeRunLog[];
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ValidationIssue {
  level: 'error' | 'warning';
  nodeId?: string;
  message: string;
  messageAr: string;
}
