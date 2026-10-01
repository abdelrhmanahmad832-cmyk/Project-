import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../api.js';

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="alert">{error}</p>;
  if (!orders) return <p className="center muted">جارٍ التحميل...</p>;

  return (
    <>
      <h2>طلباتي</h2>
      {!orders.length && (
        <div className="center">
          <p className="muted">لا توجد طلبات بعد.</p>
          <Link to="/" className="btn">ابدأ التسوق</Link>
        </div>
      )}
      {orders.map((o) => (
        <Link key={o.id} to={`/orders/${o.id}`} className="card pad order order-link">
          <div className="order-head">
            <strong>طلب #{o.id}</strong>
            <span className={`status status-${o.status}`}>{STATUS_LABELS[o.status]}</span>
            {o.payment_method === 'card' && (
              <span className={`status pay-${o.payment_status}`}>{PAYMENT_STATUS_LABELS[o.payment_status]}</span>
            )}
            <span className="muted small">{formatDate(o.created_at)}</span>
          </div>
          <p className="muted">{o.items.map((i) => `${i.product_name} × ${i.quantity}`).join('، ')}</p>
          <strong>{formatPrice(o.total)}</strong>
        </Link>
      ))}
    </>
  );
}
