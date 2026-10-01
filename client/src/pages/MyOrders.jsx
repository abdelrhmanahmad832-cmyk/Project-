import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Receipt, CaretLeft } from '@phosphor-icons/react';
import { api, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS } from '../api.js';
import Empty from '../components/Empty.jsx';
import Notice from '../components/Notice.jsx';

export default function MyOrders() {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders/mine').then(setOrders).catch((e) => setError(e.message));
  }, []);

  if (error) return <Notice type="error">{error}</Notice>;

  return (
    <>
      <div className="page-head"><h1>طلباتي</h1></div>
      {!orders ? (
        <div className="stack">{[0, 1, 2].map((i) => <div key={i} className="skeleton" style={{ height: 88 }} />)}</div>
      ) : !orders.length ? (
        <Empty icon={Receipt} title="لا توجد طلبات بعد" action={<Link to="/" className="btn">ابدأ التسوق</Link>}>
          ستظهر هنا طلباتك وحالة توصيلها.
        </Empty>
      ) : (
        <ul className="order-list">
          {orders.map((o) => (
            <li key={o.id}>
              <Link to={`/orders/${o.id}`} className="order-row" style={{ gridTemplateColumns: '1fr auto auto' }}>
                <div className="order-row-main">
                  <div className="row">
                    <strong className="num">طلب #{o.id}</strong>
                    <span className={`badge st-${o.status}`}>{STATUS_LABELS[o.status]}</span>
                    {o.payment_method === 'card' && o.status !== 'cancelled' && (
                      <span className={`badge pay-${o.payment_status}`}>{PAYMENT_STATUS_LABELS[o.payment_status]}</span>
                    )}
                  </div>
                  <span className="order-row-items">{o.items.map((i) => `${i.product_name} × ${i.quantity}`).join('، ')}</span>
                  <span className="muted small">{formatDate(o.created_at)}</span>
                </div>
                <strong className="num">{formatPrice(o.total)}</strong>
                <CaretLeft size={18} className="muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
