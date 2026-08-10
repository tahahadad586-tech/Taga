import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { Workflow } from '@taga/shared';
import { api, setToken } from '../api';

export default function Dashboard() {
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const load = () => {
    api.listWorkflows().then(setWorkflows).catch((e) => setError(String(e.message ?? e)));
  };

  useEffect(load, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      const workflow = await api.createWorkflow(name.trim());
      navigate(`/app/workflows/${workflow.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  const remove = async (id: string) => {
    await api.deleteWorkflow(id);
    load();
  };

  return (
    <div>
      <div className="topbar">
        <Link to="/" className="brand">⚡ Taga</Link>
        <button
          className="secondary"
          onClick={() => {
            setToken(null);
            navigate('/login');
          }}
        >
          تسجيل الخروج
        </button>
      </div>
      <div className="dashboard">
        <h2>تدفقاتي</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <input placeholder="اسم التدفق الجديد" value={name} onChange={(e) => setName(e.target.value)} />
          <button onClick={create}>إنشاء تدفق</button>
        </div>
        {error && <div className="issues">{error}</div>}
        <div className="workflow-list">
          {workflows.map((workflow) => (
            <div className="workflow-item" key={workflow.id}>
              <div>
                <Link to={`/app/workflows/${workflow.id}`} style={{ fontWeight: 'bold' }}>
                  {workflow.name}
                </Link>
                <div className="meta">
                  الإصدار {workflow.version} · المشغّل: {triggerLabel(workflow.trigger.type)} · آخر تحديث{' '}
                  {new Date(workflow.updatedAt).toLocaleString('ar')}
                </div>
              </div>
              <button className="danger" onClick={() => remove(workflow.id)}>حذف</button>
            </div>
          ))}
          {workflows.length === 0 && <p style={{ color: 'var(--muted)' }}>لا توجد تدفقات بعد — أنشئ أول تدفق لك!</p>}
        </div>
      </div>
    </div>
  );
}

function triggerLabel(type: string): string {
  switch (type) {
    case 'webhook':
      return 'Webhook';
    case 'schedule':
      return 'جدولة';
    default:
      return 'يدوي';
  }
}
