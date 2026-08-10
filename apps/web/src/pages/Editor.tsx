import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ReactFlow, {
  addEdge,
  Background,
  Controls,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type ReactFlowInstance
} from 'reactflow';
import 'reactflow/dist/style.css';
import { CATEGORY_LABELS_AR, NODE_CATALOG, NODE_CATALOG_BY_TYPE, type ValidationIssue, type Workflow, type WorkflowRun } from '@taga/shared';
import { api } from '../api';
import TagaNode from '../components/TagaNode';

const nodeTypes = { taga: TagaNode };

function toFlowNodes(workflow: Workflow): Node[] {
  return workflow.graph.nodes.map((node) => ({
    id: node.id,
    type: 'taga',
    position: node.position,
    data: { nodeType: node.type, params: node.params }
  }));
}

function toFlowEdges(workflow: Workflow): Edge[] {
  return workflow.graph.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    sourceHandle: edge.sourceHandle,
    target: edge.target,
    targetHandle: edge.targetHandle
  }));
}

export default function Editor() {
  const { id } = useParams<{ id: string }>();
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const flowRef = useRef<ReactFlowInstance | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!id) return;
    api.getWorkflow(id).then((wf) => {
      setWorkflow(wf);
      setNodes(toFlowNodes(wf));
      setEdges(toFlowEdges(wf));
    });
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [id, setNodes, setEdges]);

  const currentGraph = useCallback(
    () => ({
      nodes: nodes.map((node) => ({
        id: node.id,
        type: (node.data as { nodeType: string }).nodeType,
        position: node.position,
        params: (node.data as { params: Record<string, unknown> }).params ?? {}
      })),
      edges: edges.map((edge) => ({
        id: edge.id,
        source: edge.source,
        sourceHandle: edge.sourceHandle ?? undefined,
        target: edge.target,
        targetHandle: edge.targetHandle ?? undefined
      }))
    }),
    [nodes, edges]
  );

  const save = useCallback(async () => {
    if (!id || !workflow) return;
    setSaving(true);
    try {
      const updated = await api.updateWorkflow(id, { graph: currentGraph(), trigger: workflow.trigger, name: workflow.name });
      setWorkflow(updated);
      setMessage(`تم الحفظ (الإصدار ${updated.version})`);
      setIssues(await api.validateWorkflow(id, updated.graph));
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  }, [id, workflow, currentGraph]);

  const runNow = useCallback(async () => {
    if (!id) return;
    await save();
    try {
      const { runId } = await api.runWorkflow(id);
      setMessage('جارٍ التشغيل...');
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const details = await api.getRun(runId);
        setRun(details);
        if (details.status !== 'running' && details.status !== 'queued') {
          if (pollRef.current) clearInterval(pollRef.current);
          setMessage(details.status === 'succeeded' ? 'نجح التشغيل ✅' : `فشل التشغيل: ${details.error ?? ''}`);
        }
      }, 500);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'فشل التشغيل');
    }
  }, [id, save]);

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  );

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const nodeType = event.dataTransfer.getData('application/taga-node');
      if (!nodeType || !flowRef.current) return;
      const position = flowRef.current.screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const definition = NODE_CATALOG_BY_TYPE[nodeType];
      const params: Record<string, unknown> = {};
      for (const param of definition?.params ?? []) {
        if (param.default !== undefined) params[param.key] = param.default;
      }
      setNodes((existing) => [
        ...existing,
        {
          id: `${nodeType.replace(/\W/g, '_')}_${Date.now().toString(36)}`,
          type: 'taga',
          position,
          data: { nodeType, params }
        }
      ]);
    },
    [setNodes]
  );

  const selectedNode = useMemo(() => nodes.find((n) => n.id === selectedNodeId), [nodes, selectedNodeId]);
  const selectedDefinition = selectedNode ? NODE_CATALOG_BY_TYPE[(selectedNode.data as { nodeType: string }).nodeType] : null;

  const updateParam = (key: string, value: unknown) => {
    if (!selectedNodeId) return;
    setNodes((existing) =>
      existing.map((node) =>
        node.id === selectedNodeId
          ? { ...node, data: { ...node.data, params: { ...(node.data as { params: Record<string, unknown> }).params, [key]: value } } }
          : node
      )
    );
  };

  const categories = useMemo(() => {
    const map = new Map<string, typeof NODE_CATALOG>();
    for (const definition of NODE_CATALOG) {
      const list = map.get(definition.category) ?? [];
      list.push(definition);
      map.set(definition.category, list);
    }
    return map;
  }, []);

  if (!workflow) return <div style={{ padding: 40 }}>جارٍ التحميل...</div>;

  return (
    <div>
      <div className="topbar">
        <div className="editor-toolbar">
          <Link to="/app" className="brand">⚡ Taga</Link>
          <strong>{workflow.name}</strong>
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>الإصدار {workflow.version}</span>
        </div>
        <div className="editor-toolbar">
          <select
            value={workflow.trigger.type}
            onChange={(e) =>
              setWorkflow({ ...workflow, trigger: { type: e.target.value as Workflow['trigger']['type'], cron: workflow.trigger.cron } })
            }
            style={{ width: 140 }}
          >
            <option value="manual">تشغيل يدوي</option>
            <option value="webhook">Webhook</option>
            <option value="schedule">جدولة (Cron)</option>
          </select>
          {workflow.trigger.type === 'schedule' && (
            <input
              style={{ width: 130, direction: 'ltr' }}
              placeholder="*/5 * * * *"
              value={workflow.trigger.cron ?? ''}
              onChange={(e) => setWorkflow({ ...workflow, trigger: { ...workflow.trigger, cron: e.target.value } })}
            />
          )}
          <span style={{ color: 'var(--muted)', fontSize: 13 }}>{message}</span>
          <button className="secondary" onClick={save} disabled={saving}>حفظ</button>
          <button onClick={runNow}>تشغيل ▶</button>
        </div>
      </div>

      <div className="editor-layout">
        <div className="palette">
          <h3 style={{ marginTop: 0 }}>مكتبة العُقد</h3>
          {[...categories.entries()].map(([category, definitions]) => (
            <div key={category}>
              <h4>{CATEGORY_LABELS_AR[category] ?? category}</h4>
              {definitions.map((definition) => (
                <div
                  key={definition.type}
                  className="palette-node"
                  draggable
                  title={definition.descriptionAr}
                  onDragStart={(e) => e.dataTransfer.setData('application/taga-node', definition.type)}
                >
                  {definition.labelAr}
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="canvas" onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onInit={(instance) => (flowRef.current = instance)}
            onNodeClick={(_e, node) => setSelectedNodeId(node.id)}
            onPaneClick={() => setSelectedNodeId(null)}
            deleteKeyCode={['Backspace', 'Delete']}
            fitView
          >
            <Background />
            <Controls position="bottom-right" />
          </ReactFlow>
        </div>

        <div className="config-panel">
          {selectedNode && selectedDefinition ? (
            <>
              <h3 style={{ margin: 0 }}>{selectedDefinition.labelAr}</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13, margin: 0 }}>{selectedDefinition.descriptionAr}</p>
              {selectedDefinition.params.map((param) => {
                const value = ((selectedNode.data as { params: Record<string, unknown> }).params ?? {})[param.key] ?? '';
                return (
                  <div key={param.key}>
                    <label>
                      {param.labelAr}
                      {param.required ? ' *' : ''}
                    </label>
                    {param.type === 'text' || param.type === 'json' ? (
                      <textarea
                        rows={4}
                        value={String(value)}
                        placeholder={param.placeholder}
                        onChange={(e) => updateParam(param.key, e.target.value)}
                      />
                    ) : param.type === 'select' ? (
                      <select value={String(value)} onChange={(e) => updateParam(param.key, e.target.value)}>
                        {(param.options ?? []).map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={String(value)}
                        placeholder={param.placeholder}
                        onChange={(e) => updateParam(param.key, e.target.value)}
                      />
                    )}
                  </div>
                );
              })}
              <button
                className="danger"
                onClick={() => {
                  setNodes((existing) => existing.filter((n) => n.id !== selectedNodeId));
                  setEdges((existing) => existing.filter((e) => e.source !== selectedNodeId && e.target !== selectedNodeId));
                  setSelectedNodeId(null);
                }}
              >
                حذف العقدة
              </button>
            </>
          ) : (
            <>
              <h3 style={{ margin: 0 }}>الإعدادات</h3>
              <p style={{ color: 'var(--muted)', fontSize: 13 }}>
                اسحب عقدة من المكتبة إلى اللوحة، ثم اضغط عليها لتعديل إعداداتها. اربط مخرجات العُقد بمدخلات عُقد أخرى لبناء التدفق.
              </p>
              {workflow.trigger.type === 'webhook' && (
                <div>
                  <label>رابط الـ Webhook</label>
                  <pre className="mini">POST /api/hooks/{workflow.id}</pre>
                </div>
              )}
              {issues.length > 0 && (
                <div className="issues">
                  <strong>ملاحظات التحقق:</strong>
                  <ul>
                    {issues.map((issue, index) => (
                      <li key={index}>{issue.messageAr}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {run && (
        <div className="run-panel">
          <strong>
            سجل التشغيل — الحالة: <span className={`status-${run.status}`}>{run.status}</span>
          </strong>
          {run.logs.map((log) => (
            <div className="log-row" key={log.nodeId + log.startedAt}>
              <span className={`status-${log.status}`}>{log.status === 'succeeded' ? '✔' : log.status === 'failed' ? '✖' : '⤼'}</span>
              <span style={{ minWidth: 140 }}>{NODE_CATALOG_BY_TYPE[log.nodeType]?.labelAr ?? log.nodeType}</span>
              <span style={{ color: 'var(--muted)' }}>{log.durationMs}ms · محاولات: {log.attempts}</span>
              {log.error && <span className="issues">{log.error}</span>}
              <pre className="mini">{JSON.stringify(log.output)}</pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
