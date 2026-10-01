import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Notice from '../components/Notice.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await register(form.name, form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>حساب جديد</h1>
      <p>أنشئ حساباً لتتابع طلباتك وتحفظ عنوانك.</p>
      <form className="panel" onSubmit={submit}>
        {error && <Notice type="error">{error}</Notice>}
        <label className="field"><span>الاسم</span><input className="input" required autoComplete="name" value={form.name} onChange={set('name')} /></label>
        <label className="field"><span>البريد الإلكتروني</span><input className="input" type="email" dir="ltr" required autoComplete="email" value={form.email} onChange={set('email')} /></label>
        <label className="field"><span>كلمة المرور</span><input className="input" type="password" minLength={6} required autoComplete="new-password" value={form.password} onChange={set('password')} /><span className="hint">6 أحرف على الأقل</span></label>
        <button className="btn btn-lg btn-block" disabled={busy}>{busy ? 'جارٍ الإنشاء…' : 'إنشاء الحساب'}</button>
      </form>
      <p className="alt">لديك حساب؟ <Link to="/login" state={location.state} className="link">سجّل الدخول</Link></p>
    </div>
  );
}
