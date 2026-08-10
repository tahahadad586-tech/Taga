import { Link } from 'react-router-dom';
import { getToken } from '../api';

const FEATURES = [
  { title: 'محرر مرئي بالسحب والإفلات', body: 'ابنِ تدفقات العمل بربط العُقد بصريًا — بدون كتابة أي كود.' },
  { title: 'عُقد ذكاء اصطناعي', body: 'استدعِ نماذج اللغة الكبيرة للتلخيص والتصنيف واستخراج البيانات مباشرة داخل تدفقك.' },
  { title: 'مشغّلات مرنة', body: 'شغّل تدفقاتك يدويًا، أو بجدولة زمنية (Cron)، أو عبر Webhooks من أي نظام خارجي.' },
  { title: 'سجلات تنفيذ مفصّلة', body: 'شاهد مدخلات ومخرجات كل عقدة، وزمن التنفيذ، وعدد المحاولات لكل تشغيل.' },
  { title: 'دعم كامل للعربية', body: 'واجهة عربية RTL بالكامل مع معالجة نصوص عربية في عُقد الذكاء الاصطناعي.' },
  { title: 'إصدارات تلقائية', body: 'كل حفظ ينشئ إصدارًا جديدًا حتى تعود لأي نسخة سابقة من تدفقك.' }
];

export default function Landing() {
  const loggedIn = Boolean(getToken());
  return (
    <div className="landing">
      <div className="topbar" style={{ borderRadius: 12, marginTop: 12 }}>
        <span className="brand">⚡ Taga</span>
        <div>
          {loggedIn ? <Link to="/app"><button>لوحة التحكم</button></Link> : <Link to="/login"><button>تسجيل الدخول</button></Link>}
        </div>
      </div>
      <div className="hero">
        <h1>أتمتة سير العمل بالذكاء الاصطناعي</h1>
        <p>
          منصة No-Code لبناء تدفقات عمل آلية: اجلب البيانات، عالجها بالذكاء الاصطناعي، وأرسل النتائج إلى أي مكان — كل ذلك
          بواجهة سحب وإفلات عربية بالكامل.
        </p>
        <Link to={loggedIn ? '/app' : '/login'}>
          <button style={{ fontSize: 16, padding: '12px 32px' }}>ابدأ مجانًا</button>
        </Link>
      </div>
      <div className="features">
        {FEATURES.map((feature) => (
          <div className="feature-card" key={feature.title}>
            <h3>{feature.title}</h3>
            <p>{feature.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
