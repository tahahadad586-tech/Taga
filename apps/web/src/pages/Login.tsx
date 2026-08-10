import { useState, type FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, setToken } from '../api';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    try {
      const result =
        mode === 'login' ? await api.login(email, password) : await api.register(email, password, name);
      setToken(result.token);
      navigate('/app');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'حدث خطأ');
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <Link to="/" style={{ textAlign: 'center', fontSize: 22 }}>⚡ Taga</Link>
        <h2 style={{ margin: 0, textAlign: 'center' }}>{mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}</h2>
        {mode === 'register' && (
          <input placeholder="الاسم" value={name} onChange={(e) => setName(e.target.value)} />
        )}
        <input type="email" required placeholder="البريد الإلكتروني" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input
          type="password"
          required
          minLength={8}
          placeholder="كلمة المرور (8 أحرف على الأقل)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {error && <div className="issues">{error}</div>}
        <button type="submit">{mode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button>
        <button type="button" className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
          {mode === 'login' ? 'ليس لديك حساب؟ سجّل الآن' : 'لديك حساب؟ سجّل الدخول'}
        </button>
      </form>
    </div>
  );
}
