import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, formatPrice, STATUS_LABELS } from '../api.js';

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');
  const location = useLocation();

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!orders) return <p className="center muted">جارٍ التحميل...</p>;

  return (
    <>
      <h2>طلباتي</h2>
      {location.state?.placed && <p className="success">تم استلام طلبك بنجاح! 🎉</p>}
      {!orders.length && <p className="muted">لا توجد طلبات بعد.</p>}
      {orders.map((o) => (
        <div key={o.id} className="card pad order">
          <div className="order-head">
            <strong>طلب #{o.id}</strong>
            <span className={`status status-${o.status}`}>{STATUS_LABELS[o.status]}</span>
            <span className="muted">{new Date(o.created_at + 'Z').toLocaleString('ar-EG')}</span>
          </div>
          <ul>
            {o.items.map((i) => <li key={i.id}>{i.product_name} × {i.quantity} — {formatPrice(i.unit_price * i.quantity)}</li>)}
          </ul>
          <strong>الإجمالي: {formatPrice(o.total)}</strong>
        </div>
      ))}
    </>
  );
}
