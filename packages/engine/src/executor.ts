import type { NodeRunLog, WorkflowGraph, WorkflowNode } from '@taga/shared';

export interface NodeContext {
  /** Resolved inputs keyed by target handle name (or 'input' by default). */
  inputs: Record<string, unknown>;
  /** Node parameters from the editor. */
  params: Record<string, unknown>;
  /** The run-level input (webhook payload / manual input). */
  runInput: Record<string, unknown>;
}

export type NodeHandler = (ctx: NodeContext) => Promise<Record<string, unknown>>;

export type HandlerRegistry = Record<string, NodeHandler>;

export interface ExecuteOptions {
  runInput?: Record<string, unknown>;
  maxAttempts?: number;
  onNodeFinished?: (log: NodeRunLog) => void;
}

export interface ExecutionResult {
  status: 'succeeded' | 'failed';
  output: Record<string, unknown>;
  logs: NodeRunLog[];
  error?: string;
}

/**
 * Executes a workflow graph as a DAG: nodes whose upstream dependencies are
 * complete run in parallel. Supports per-node retries and conditional
 * branches (edges from a `logic.condition` node's true/false handles skip
 * downstream nodes on the inactive branch).
 */
export async function executeWorkflow(
  graph: WorkflowGraph,
  handlers: HandlerRegistry,
  options: ExecuteOptions = {}
): Promise<ExecutionResult> {
  const { runInput = {}, maxAttempts = 2, onNodeFinished } = options;
  const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
  const incoming = new Map<string, typeof graph.edges>();
  const outgoing = new Map<string, typeof graph.edges>();
  for (const node of graph.nodes) {
    incoming.set(node.id, []);
    outgoing.set(node.id, []);
  }
  for (const edge of graph.edges) {
    incoming.get(edge.target)?.push(edge);
    outgoing.get(edge.source)?.push(edge);
  }

  const outputs = new Map<string, Record<string, unknown>>();
  const skipped = new Set<string>();
  const done = new Set<string>();
  const logs: NodeRunLog[] = [];
  let failure: string | undefined;

  const isReady = (node: WorkflowNode) =>
    !done.has(node.id) && (incoming.get(node.id) ?? []).every((e) => done.has(e.source));

  const markSkippedDownstream = (nodeId: string, viaHandle?: string) => {
    for (const edge of outgoing.get(nodeId) ?? []) {
      if (viaHandle !== undefined && edge.sourceHandle !== viaHandle) continue;
      const target = edge.target;
      if (skipped.has(target)) continue;
      // Only skip a node when ALL of its incoming edges come from skipped or inactive sources.
      const targetIncoming = incoming.get(target) ?? [];
      const allInactive = targetIncoming.every((e) => {
        if (skipped.has(e.source)) return true;
        if (e.source === nodeId && (viaHandle === undefined || e.sourceHandle === viaHandle)) return true;
        const sourceOutput = outputs.get(e.source);
        return sourceOutput !== undefined && e.sourceHandle !== undefined && !(e.sourceHandle in sourceOutput);
      });
      if (allInactive) {
        skipped.add(target);
        markSkippedDownstream(target);
      }
    }
  };

  const resolveInputs = (node: WorkflowNode): Record<string, unknown> => {
    const resolved: Record<string, unknown> = {};
    for (const edge of incoming.get(node.id) ?? []) {
      const sourceOutput = outputs.get(edge.source);
      if (!sourceOutput) continue;
      const value =
        edge.sourceHandle !== undefined && edge.sourceHandle in sourceOutput
          ? sourceOutput[edge.sourceHandle]
          : edge.sourceHandle !== undefined
            ? undefined
            : firstValue(sourceOutput);
      if (value === undefined) continue;
      const key = edge.targetHandle ?? 'input';
      resolved[key] = value;
    }
    return resolved;
  };

  const runNode = async (node: WorkflowNode): Promise<void> => {
    if (skipped.has(node.id)) {
      done.add(node.id);
      const now = new Date().toISOString();
      const log: NodeRunLog = {
        nodeId: node.id,
        nodeType: node.type,
        status: 'skipped',
        input: {},
        output: {},
        startedAt: now,
        finishedAt: now,
        durationMs: 0,
        attempts: 0
      };
      logs.push(log);
      onNodeFinished?.(log);
      return;
    }

    const handler = handlers[node.type];
    const input = resolveInputs(node);
    const startedAt = new Date();
    let attempts = 0;
    let output: Record<string, unknown> = {};
    let error: string | undefined;

    if (!handler) {
      error = `No handler registered for node type "${node.type}"`;
    } else {
      while (attempts < maxAttempts) {
        attempts += 1;
        try {
          output = await handler({ inputs: input, params: node.params, runInput });
          error = undefined;
          break;
        } catch (err) {
          error = err instanceof Error ? err.message : String(err);
        }
      }
    }

    const finishedAt = new Date();
    const log: NodeRunLog = {
      nodeId: node.id,
      nodeType: node.type,
      status: error ? 'failed' : 'succeeded',
      input,
      output,
      error,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      durationMs: finishedAt.getTime() - startedAt.getTime(),
      attempts
    };
    logs.push(log);
    onNodeFinished?.(log);
    done.add(node.id);

    if (error) {
      failure = failure ?? `Node ${node.id} (${node.type}) failed: ${error}`;
      markSkippedDownstream(node.id);
      return;
    }

    outputs.set(node.id, output);
    // Conditional branches: skip downstream nodes on handles the node did not emit.
    const emittedHandles = new Set(Object.keys(output));
    const nodeOutgoing = outgoing.get(node.id) ?? [];
    const usesHandles = nodeOutgoing.some((e) => e.sourceHandle !== undefined);
    if (usesHandles) {
      for (const edge of nodeOutgoing) {
        if (edge.sourceHandle !== undefined && !emittedHandles.has(edge.sourceHandle)) {
          markSkippedDownstream(node.id, edge.sourceHandle);
        }
      }
    }
  };

  // Level-parallel execution over the DAG.
  while (done.size < graph.nodes.length) {
    const ready = graph.nodes.filter(isReady);
    if (ready.length === 0) {
      failure = failure ?? 'Workflow deadlocked (cycle or unreachable nodes)';
      break;
    }
    await Promise.all(ready.map(runNode));
  }

  // Terminal outputs: outputs of nodes with no outgoing edges.
  const finalOutput: Record<string, unknown> = {};
  for (const node of graph.nodes) {
    if ((outgoing.get(node.id) ?? []).length === 0 && outputs.has(node.id)) {
      finalOutput[node.id] = outputs.get(node.id);
    }
  }

  return {
    status: failure ? 'failed' : 'succeeded',
    output: finalOutput,
    logs,
    error: failure
  };
}

function firstValue(record: Record<string, unknown>): unknown {
  const keys = Object.keys(record);
  return keys.length > 0 ? record[keys[0]] : undefined;
}
