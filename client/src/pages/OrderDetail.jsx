import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import {
  api, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS,
} from '../api.js';
import { useToast } from '../context/ToastContext.jsx';

const STEPS = ['pending', 'processing', 'shipped', 'delivered'];

export default function OrderDetail() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const location = useLocation();
  const toast = useToast();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const returnedFromStripe = params.has('session_id');
  const canceledPayment = params.has('canceled');

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        let o = await api(`/orders/${id}`);
        // Back from Stripe: confirm the payment (retry briefly while Stripe finalizes it).
        if (returnedFromStripe && o.payment_method === 'card') {
          for (let i = 0; i < 5 && o.payment_status === 'unpaid' && !stop; i++) {
            o = await api(`/orders/${id}/verify-payment`, { method: 'POST' });
            if (o.payment_status === 'unpaid') await new Promise((r) => setTimeout(r, 1500));
          }
        }
        if (!stop) setOrder(o);
      } catch (e) {
        if (!stop) setError(e.message);
      }
    };
    load();
    return () => { stop = true; };
  }, [id, returnedFromStripe]);

  const payNow = async () => {
    setBusy(true);
    try {
      const { order: o, checkoutUrl } = await api(`/orders/${id}/pay`, { method: 'POST' });
      if (checkoutUrl) window.location.assign(checkoutUrl);
      else { setOrder(o); setBusy(false); }
    } catch (e) {
      toast(e.message, 'error');
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!confirm('هل تريد إلغاء هذا الطلب؟')) return;
    setBusy(true);
    try {
      setOrder(await api(`/orders/${id}/cancel`, { method: 'POST' }));
      toast('تم إلغاء الطلب');
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  if (error) return <p className="alert">{error}</p>;
  if (!order) return <p className="center muted">{returnedFromStripe ? 'جارٍ تأكيد الدفع...' : 'جارٍ التحميل...'}</p>;

  const unpaidCard = order.payment_method === 'card' && order.payment_status === 'unpaid' && order.status !== 'cancelled';
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <>
      <Link to="/orders" className="muted">→ كل طلباتي</Link>
      {location.state?.placed && <p className="success">تم استلام طلبك بنجاح! 🎉 سنتواصل معك قريباً.</p>}
      {returnedFromStripe && order.payment_status === 'paid' && <p className="success">تم الدفع بنجاح، شكراً لك! 🎉</p>}
      {returnedFromStripe && unpaidCard && <p className="info">لم يتم تأكيد الدفع بعد. إذا تم خصم المبلغ ستتحدث الحالة خلال دقائق.</p>}
      {canceledPayment && unpaidCard && <p className="alert">لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.</p>}

      <div className="card pad">
        <div className="order-head">
          <h2>طلب #{order.id}</h2>
          <span className={`status status-${order.status}`}>{STATUS_LABELS[order.status]}</span>
          <span className="muted small">{formatDate(order.created_at)}</span>
        </div>

        {order.status !== 'cancelled' && (
          <ol className="progress">
            {STEPS.map((s, i) => <li key={s} className={i <= stepIndex ? 'done' : ''}>{STATUS_LABELS[s]}</li>)}
          </ol>
        )}

        <table className="table">
          <thead><tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th></tr></thead>
          <tbody>
            {order.items.map((i) => (
              <tr key={i.id}>
                <td>{i.product_id ? <Link to={`/products/${i.product_id}`}>{i.product_name}</Link> : i.product_name}</td>
                <td>{formatPrice(i.unit_price)}</td>
                <td>{i.quantity}</td>
                <td>{formatPrice(i.unit_price * i.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="order-grid">
          <div>
            <h3>التوصيل</h3>
            <p className="pre-line">{order.address}</p>
            <p dir="ltr" className="text-start">{order.phone}</p>
          </div>
          <div>
            <h3>الدفع</h3>
            <p>{PAYMENT_METHOD_LABELS[order.payment_method]} — <span className={`status pay-${order.payment_status}`}>{PAYMENT_STATUS_LABELS[order.payment_status]}</span></p>
            <div className="summary-line"><span>المجموع الفرعي</span><span>{formatPrice(order.subtotal ?? order.total)}</span></div>
            {order.discount > 0 && <div className="summary-line success-text"><span>خصم ({order.coupon_code})</span><span>−{formatPrice(order.discount)}</span></div>}
            <div className="summary-line"><span>الشحن</span><span>{order.shipping ? formatPrice(order.shipping) : 'مجاني'}</span></div>
            <div className="summary-line total"><strong>الإجمالي</strong><strong>{formatPrice(order.total)}</strong></div>
          </div>
        </div>

        <div className="row">
          {unpaidCard && <button className="btn" disabled={busy} onClick={payNow}>💳 ادفع الآن</button>}
          {order.status === 'pending' && <button className="btn btn-ghost danger-text" disabled={busy} onClick={cancel}>إلغاء الطلب</button>}
        </div>
        {order.status === 'delivered' && <p className="muted">أعجبك طلبك؟ قيّم المنتجات من صفحة كل منتج ⭐</p>}
      </div>
    </>
  );
}
