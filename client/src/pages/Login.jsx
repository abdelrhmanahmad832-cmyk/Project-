import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import Notice from '../components/Notice.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const user = await login(email, password);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <h1>أهلاً بعودتك</h1>
      <p>سجّل الدخول لمتابعة طلباتك وإتمام الشراء.</p>
      <form className="panel" onSubmit={submit}>
        {error && <Notice type="error">{error}</Notice>}
        <label className="field"><span>البريد الإلكتروني</span><input className="input" type="email" dir="ltr" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field"><span>كلمة المرور</span><input className="input" type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <button className="btn btn-lg btn-block" disabled={busy}>{busy ? 'جارٍ الدخول…' : 'تسجيل الدخول'}</button>
      </form>
      <p className="alt">ليس لديك حساب؟ <Link to="/register" state={location.state} className="link">أنشئ حساباً</Link></p>
    </div>
  );
}
