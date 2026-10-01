import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { SignOut } from '@phosphor-icons/react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Notice from '../components/Notice.jsx';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
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
      toast('حُفظت بياناتك');
    } catch (err) {
      setError(err.message);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (pw.newPassword !== pw.confirm) return setPwError('كلمتا المرور غير متطابقتين.');
    try {
      await api('/auth/me/password', { method: 'PUT', body: { currentPassword: pw.currentPassword, newPassword: pw.newPassword } });
      setPw({ currentPassword: '', newPassword: '', confirm: '' });
      toast('تغيّرت كلمة المرور');
    } catch (err) {
      setPwError(err.message);
    }
  };

  const setI = (k) => (e) => setInfo({ ...info, [k]: e.target.value });
  const setP = (k) => (e) => setPw({ ...pw, [k]: e.target.value });

  return (
    <>
      <div className="page-head">
        <div>
          <h1>حسابي</h1>
          <p><span dir="ltr">{user.email}</span></p>
        </div>
        <button className="btn btn-ghost" onClick={() => { navigate('/', { replace: true }); logout(); }}><SignOut size={18} /> تسجيل الخروج</button>
      </div>
      <div className="profile-grid">
        <form className="panel" onSubmit={saveInfo}>
          <h2 className="panel-title">البيانات الشخصية</h2>
          {error && <Notice type="error">{error}</Notice>}
          <label className="field"><span>الاسم</span><input className="input" required autoComplete="name" value={info.name} onChange={setI('name')} /></label>
          <label className="field"><span>رقم الهاتف</span><input className="input" type="tel" dir="ltr" autoComplete="tel" value={info.phone} onChange={setI('phone')} /></label>
          <label className="field"><span>عنوان التوصيل</span><textarea className="input" autoComplete="street-address" value={info.address} onChange={setI('address')} /></label>
          <div><button className="btn">حفظ التغييرات</button></div>
        </form>
        <form className="panel" onSubmit={savePassword}>
          <h2 className="panel-title">كلمة المرور</h2>
          {pwError && <Notice type="error">{pwError}</Notice>}
          <label className="field"><span>كلمة المرور الحالية</span><input className="input" type="password" required value={pw.currentPassword} onChange={setP('currentPassword')} autoComplete="current-password" /></label>
          <label className="field"><span>كلمة المرور الجديدة</span><input className="input" type="password" minLength={6} required value={pw.newPassword} onChange={setP('newPassword')} autoComplete="new-password" /><span className="hint">6 أحرف على الأقل</span></label>
          <label className="field"><span>تأكيد كلمة المرور</span><input className="input" type="password" minLength={6} required value={pw.confirm} onChange={setP('confirm')} autoComplete="new-password" /></label>
          <div><button className="btn">تغيير كلمة المرور</button></div>
        </form>
      </div>
    </>
  );
}
