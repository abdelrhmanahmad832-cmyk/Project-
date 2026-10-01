import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function Checkout() {
  const { items, total, clear } = useCart();
  const navigate = useNavigate();
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (!items.length) return <p className="center muted">السلة فارغة. <Link to="/">تصفح المنتجات</Link></p>;

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await api('/orders', {
        method: 'POST',
        body: { address, phone, items: items.map((i) => ({ productId: i.id, quantity: i.quantity })) },
      });
      clear();
      navigate('/orders', { state: { placed: true } });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout">
      <form className="card pad form" onSubmit={submit}>
        <h2>بيانات التوصيل</h2>
        {error && <p className="alert">{error}</p>}
        <label>العنوان<textarea className="input" required value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label>رقم الهاتف<input className="input" required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <p className="muted">الدفع عند الاستلام 💵</p>
        <button className="btn" disabled={submitting}>{submitting ? 'جارٍ الإرسال...' : 'تأكيد الطلب'}</button>
      </form>
      <aside className="card pad">
        <h3>ملخص الطلب</h3>
        {items.map((i) => (
          <div key={i.id} className="summary-line"><span>{i.name} × {i.quantity}</span><span>{formatPrice(i.price * i.quantity)}</span></div>
        ))}
        <hr />
        <div className="summary-line"><strong>الإجمالي</strong><strong>{formatPrice(total)}</strong></div>
      </aside>
    </div>
  );
}
