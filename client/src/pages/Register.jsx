import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await register(form.name, form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card pad form auth-form" onSubmit={submit}>
      <h2>إنشاء حساب</h2>
      {error && <p className="alert">{error}</p>}
      <label>الاسم<input className="input" required value={form.name} onChange={set('name')} /></label>
      <label>البريد الإلكتروني<input className="input" type="email" required value={form.email} onChange={set('email')} /></label>
      <label>كلمة المرور<input className="input" type="password" minLength={6} required value={form.password} onChange={set('password')} /></label>
      <button className="btn">إنشاء الحساب</button>
      <p className="muted">لديك حساب؟ <Link to="/login" state={location.state}>سجّل الدخول</Link></p>
    </form>
  );
}
