import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const user = await login(email, password);
      navigate(location.state?.from || (user.role === 'admin' ? '/admin' : '/'), { replace: true });
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form className="card pad form auth-form" onSubmit={submit}>
      <h2>تسجيل الدخول</h2>
      {error && <p className="alert">{error}</p>}
      <label>البريد الإلكتروني<input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
      <label>كلمة المرور<input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
      <button className="btn">دخول</button>
      <p className="muted">ليس لديك حساب؟ <Link to="/register" state={location.state}>أنشئ حساباً</Link></p>
    </form>
  );
}
