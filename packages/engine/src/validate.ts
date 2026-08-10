import type { WorkflowGraph, ValidationIssue } from '@taga/shared';
import { NODE_CATALOG_BY_TYPE } from '@taga/shared';

/** Validates a workflow graph before execution (missing params, unknown nodes, cycles, orphans). */
export function validateGraph(graph: WorkflowGraph): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  if (graph.nodes.length === 0) {
    issues.push({
      level: 'error',
      message: 'Workflow has no nodes',
      messageAr: 'التدفق لا يحتوي على أي عُقد'
    });
    return issues;
  }

  for (const node of graph.nodes) {
    const definition = NODE_CATALOG_BY_TYPE[node.type];
    if (!definition) {
      issues.push({
        level: 'error',
        nodeId: node.id,
        message: `Unknown node type "${node.type}"`,
        messageAr: `نوع عقدة غير معروف "${node.type}"`
      });
      continue;
    }
    for (const param of definition.params) {
      if (param.required && (node.params[param.key] === undefined || node.params[param.key] === '')) {
        issues.push({
          level: 'error',
          nodeId: node.id,
          message: `Missing required parameter "${param.label}" on ${definition.label}`,
          messageAr: `المعامل المطلوب "${param.labelAr}" مفقود في عقدة ${definition.labelAr}`
        });
      }
    }
  }

  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) {
      issues.push({
        level: 'error',
        message: `Edge ${edge.id} references a missing node`,
        messageAr: `الوصلة ${edge.id} تشير إلى عقدة غير موجودة`
      });
    }
  }

  if (hasCycle(graph)) {
    issues.push({
      level: 'error',
      message: 'Workflow contains a cycle',
      messageAr: 'التدفق يحتوي على حلقة دائرية'
    });
  }

  const connected = new Set<string>();
  for (const edge of graph.edges) {
    connected.add(edge.source);
    connected.add(edge.target);
  }
  if (graph.nodes.length > 1) {
    for (const node of graph.nodes) {
      if (!connected.has(node.id)) {
        issues.push({
          level: 'warning',
          nodeId: node.id,
          message: `Node "${node.id}" is not connected`,
          messageAr: `العقدة "${node.id}" غير متصلة بالتدفق`
        });
      }
    }
  }

  return issues;
}

function hasCycle(graph: WorkflowGraph): boolean {
  const adjacency = new Map<string, string[]>();
  for (const node of graph.nodes) adjacency.set(node.id, []);
  for (const edge of graph.edges) {
    adjacency.get(edge.source)?.push(edge.target);
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string): boolean => {
    const current = state.get(id);
    if (current === 'visiting') return true;
    if (current === 'done') return false;
    state.set(id, 'visiting');
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    state.set(id, 'done');
    return false;
  };
  return graph.nodes.some((node) => visit(node.id));
}
