import { useState } from 'react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export default function Profile() {
  const { user, setUser } = useAuth();
  const toast = useToast();
  const [info, setInfo] = useState({ name: user.name, phone: user.phone || '', address: user.address || '' });
  const [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [pwError, setPwError] = useState('');

  const saveInfo = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const { user: u } = await api('/auth/me', { method: 'PUT', body: info });
      setUser(u);
      toast('تم حفظ بياناتك');
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.newPassword !== pw.confirm) return setPwError('كلمتا المرور غير متطابقتين');
    try {
      await api('/auth/me/password', { method: 'PUT', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast('تم تغيير كلمة المرور');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const setI = (k) => (e) => setInfo({ ...info, [k]: e.target.value });
  const setP = (k) => (e) => setPw({ ...pw, [k]: e.target.value });

  return (
    <div className="profile">
      <form className="card pad form" onSubmit={saveInfo}>
        <h2>بياناتي</h2>
        <p className="muted" dir="ltr">{user.email}</p>
        {error && <p className="alert">{error}</p>}
        <label>الاسم<input className="input" required value={info.name} onChange={setI('name')} /></label>
        <label>رقم الهاتف<input className="input" type="tel" dir="ltr" value={info.phone} onChange={setI('phone')} /></label>
        <label>عنوان التوصيل<textarea className="input" value={info.address} onChange={setI('address')} /></label>
        <button className="btn">حفظ</button>
      </form>
      <form className="card pad form" onSubmit={savePassword}>
        <h2>تغيير كلمة المرور</h2>
        {pwError && <p className="alert">{pwError}</p>}
        <label>كلمة المرور الحالية<input className="input" type="password" required value={pw.currentPassword} onChange={setP('currentPassword')} autoComplete="current-password" /></label>
        <label>كلمة المرور الجديدة<input className="input" type="password" minLength={6} required value={pw.newPassword} onChange={setP('newPassword')} autoComplete="new-password" /></label>
        <label>تأكيد كلمة المرور<input className="input" type="password" minLength={6} required value={pw.confirm} onChange={setP('confirm')} autoComplete="new-password" /></label>
        <button className="btn">تغيير كلمة المرور</button>
      </form>
    </div>
  );
}
