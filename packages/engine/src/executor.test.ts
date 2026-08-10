import { describe, expect, it } from 'vitest';
import type { WorkflowGraph } from '@taga/shared';
import { executeWorkflow } from './executor.js';
import { createDefaultHandlers } from './handlers.js';
import { validateGraph } from './validate.js';

const handlers = createDefaultHandlers({ devMode: true });

describe('executeWorkflow', () => {
  it('runs a linear flow and passes data along edges', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'hello' } },
        { id: 'b', type: 'data.template', position: { x: 0, y: 0 }, params: { template: 'got: {{data}}' } },
        { id: 'c', type: 'output.log', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'text', target: 'b', targetHandle: 'data' },
        { id: 'e2', source: 'b', sourceHandle: 'text', target: 'c', targetHandle: 'value' }
      ]
    };
    const result = await executeWorkflow(graph, handlers);
    expect(result.status).toBe('succeeded');
    expect(result.output).toEqual({ c: { value: 'got: hello', label: 'output' } });
    expect(result.logs).toHaveLength(3);
  });

  it('runs independent branches in parallel and merges terminal outputs', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'x' } },
        { id: 'b', type: 'output.log', position: { x: 0, y: 0 }, params: { label: 'b' } },
        { id: 'c', type: 'output.log', position: { x: 0, y: 0 }, params: { label: 'c' } }
      ],
      edges: [
        { id: 'e1', source: 'a', sourceHandle: 'text', target: 'b', targetHandle: 'value' },
        { id: 'e2', source: 'a', sourceHandle: 'text', target: 'c', targetHandle: 'value' }
      ]
    };
    const result = await executeWorkflow(graph, handlers);
    expect(result.status).toBe('succeeded');
    expect(Object.keys(result.output).sort()).toEqual(['b', 'c']);
  });

  it('skips the inactive branch of a condition node', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'in', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'yes' } },
        { id: 'cond', type: 'logic.condition', position: { x: 0, y: 0 }, params: { operator: 'equals', compareTo: 'yes' } },
        { id: 'onTrue', type: 'output.log', position: { x: 0, y: 0 }, params: { label: 't' } },
        { id: 'onFalse', type: 'output.log', position: { x: 0, y: 0 }, params: { label: 'f' } }
      ],
      edges: [
        { id: 'e1', source: 'in', sourceHandle: 'text', target: 'cond', targetHandle: 'value' },
        { id: 'e2', source: 'cond', sourceHandle: 'true', target: 'onTrue', targetHandle: 'value' },
        { id: 'e3', source: 'cond', sourceHandle: 'false', target: 'onFalse', targetHandle: 'value' }
      ]
    };
    const result = await executeWorkflow(graph, handlers);
    expect(result.status).toBe('succeeded');
    const falseLog = result.logs.find((l) => l.nodeId === 'onFalse');
    expect(falseLog?.status).toBe('skipped');
    expect(result.output.onTrue).toEqual({ value: 'yes', label: 't' });
    expect(result.output.onFalse).toBeUndefined();
  });

  it('retries a failing node and reports failure with attempts', async () => {
    let calls = 0;
    const flaky = {
      ...handlers,
      'test.fail': async () => {
        calls += 1;
        throw new Error('boom');
      }
    };
    const graph: WorkflowGraph = {
      nodes: [{ id: 'x', type: 'test.fail', position: { x: 0, y: 0 }, params: {} }],
      edges: []
    };
    const result = await executeWorkflow(graph, flaky, { maxAttempts: 3 });
    expect(result.status).toBe('failed');
    expect(calls).toBe(3);
    expect(result.logs[0].attempts).toBe(3);
    expect(result.error).toContain('boom');
  });

  it('runs sandboxed custom code', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'a', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'ab' } },
        { id: 'code', type: 'logic.code', position: { x: 0, y: 0 }, params: { code: 'return { result: input.length * 2 };' } }
      ],
      edges: [{ id: 'e1', source: 'a', sourceHandle: 'text', target: 'code', targetHandle: 'input' }]
    };
    const result = await executeWorkflow(graph, handlers);
    expect(result.status).toBe('succeeded');
    expect(result.output.code).toEqual({ result: 4 });
  });

  it('uses run input for input.text via inputKey and webhook trigger payload', async () => {
    const graph: WorkflowGraph = {
      nodes: [
        { id: 'hook', type: 'trigger.webhook', position: { x: 0, y: 0 }, params: {} },
        { id: 'log', type: 'output.log', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [{ id: 'e1', source: 'hook', sourceHandle: 'payload', target: 'log', targetHandle: 'value' }]
    };
    const result = await executeWorkflow(graph, handlers, { runInput: { name: 'Taga' } });
    expect(result.status).toBe('succeeded');
    expect(result.output.log).toEqual({ value: { name: 'Taga' }, label: 'output' });
  });
});

describe('validateGraph', () => {
  it('flags empty graphs', () => {
    const issues = validateGraph({ nodes: [], edges: [] });
    expect(issues.some((i) => i.level === 'error')).toBe(true);
  });

  it('flags unknown node types, missing params and cycles', () => {
    const issues = validateGraph({
      nodes: [
        { id: 'a', type: 'nope', position: { x: 0, y: 0 }, params: {} },
        { id: 'b', type: 'logic.condition', position: { x: 0, y: 0 }, params: {} },
        { id: 'c', type: 'output.log', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [
        { id: 'e1', source: 'b', target: 'c' },
        { id: 'e2', source: 'c', target: 'b' }
      ]
    });
    expect(issues.some((i) => i.message.includes('Unknown node type'))).toBe(true);
    expect(issues.some((i) => i.message.includes('Missing required parameter'))).toBe(true);
    expect(issues.some((i) => i.message.includes('cycle'))).toBe(true);
  });

  it('accepts a valid flow', () => {
    const issues = validateGraph({
      nodes: [
        { id: 'a', type: 'input.text', position: { x: 0, y: 0 }, params: { value: 'x' } },
        { id: 'b', type: 'output.log', position: { x: 0, y: 0 }, params: {} }
      ],
      edges: [{ id: 'e1', source: 'a', sourceHandle: 'text', target: 'b', targetHandle: 'value' }]
    });
    expect(issues.filter((i) => i.level === 'error')).toHaveLength(0);
  });
});
