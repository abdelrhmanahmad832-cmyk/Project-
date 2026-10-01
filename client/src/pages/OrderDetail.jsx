import { useEffect, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, CreditCard } from '@phosphor-icons/react';
import {
  api, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS,
} from '../api.js';
import { useToast } from '../context/ToastContext.jsx';
import Notice from '../components/Notice.jsx';

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
      toast('أُلغي الطلب');
    } catch (e) {
      toast(e.message, 'error');
    }
    setBusy(false);
  };

  if (error) return <Notice type="error">{error}</Notice>;
  if (!order) {
    return returnedFromStripe ? <p className="muted">جارٍ تأكيد الدفع…</p> : <div className="skeleton" style={{ height: 360 }} />;
  }

  const unpaidCard = order.payment_method === 'card' && order.payment_status === 'unpaid' && order.status !== 'cancelled';
  const stepIndex = STEPS.indexOf(order.status);

  return (
    <>
      <Link to="/orders" className="back-link"><ArrowRight size={16} /> كل طلباتي</Link>
      <div className="stack" style={{ marginBottom: 20 }}>
        {location.state?.placed && <Notice type="success">استلمنا طلبك وسنبدأ تجهيزه قريباً.</Notice>}
        {returnedFromStripe && order.payment_status === 'paid' && <Notice type="success">تم الدفع. شكراً لك.</Notice>}
        {returnedFromStripe && unpaidCard && <Notice type="info">لم يُؤكَّد الدفع بعد. إذا خُصم المبلغ ستتحدث الحالة خلال دقائق.</Notice>}
        {canceledPayment && unpaidCard && <Notice type="error">لم تكتمل عملية الدفع. يمكنك المحاولة مرة أخرى.</Notice>}
      </div>

      <div className="page-head">
        <div>
          <h1 className="num">طلب #{order.id}</h1>
          <p>{formatDate(order.created_at)}</p>
        </div>
        <div className="row">
          {unpaidCard && <button className="btn btn-accent" disabled={busy} onClick={payNow}><CreditCard size={18} /> ادفع الآن</button>}
          {order.status === 'pending' && <button className="btn btn-danger" disabled={busy} onClick={cancel}>إلغاء الطلب</button>}
        </div>
      </div>

      <div className="panel">
        {order.status === 'cancelled' ? (
          <p style={{ marginBottom: 20 }}><span className="badge st-cancelled">ملغي</span></p>
        ) : (
          <ol className="timeline" aria-label="حالة الطلب">
            {STEPS.map((s, i) => (
              <li key={s} className={i <= stepIndex ? 'done' : ''} aria-current={i === stepIndex ? 'step' : undefined}>
                <span className="dot">{i <= stepIndex ? <Check size={14} weight="bold" /> : <span className="num small">{i + 1}</span>}</span>
                {STATUS_LABELS[s]}
              </li>
            ))}
          </ol>
        )}

        <ul className="line-items">
          {order.items.map((i) => (
            <li key={i.id} className="summary-line" style={{ padding: '12px 0', borderBottom: '1px solid var(--line)' }}>
              <span>
                {i.product_id ? <Link to={`/products/${i.product_id}`} className="link">{i.product_name}</Link> : i.product_name}
                <span className="muted num"> × {i.quantity}</span>
              </span>
              <span>{formatPrice(i.unit_price * i.quantity)}</span>
            </li>
          ))}
        </ul>

        <div className="info-grid" style={{ marginTop: 28 }}>
          <div>
            <h3>التوصيل إلى</h3>
            <p className="pre-line">{order.address}</p>
            <p className="muted"><span dir="ltr">{order.phone}</span></p>
          </div>
          <div>
            <h3>الدفع</h3>
            <p className="row" style={{ marginBottom: 10 }}>
              {PAYMENT_METHOD_LABELS[order.payment_method]}
              <span className={`badge pay-${order.payment_status}`}>{PAYMENT_STATUS_LABELS[order.payment_status]}</span>
            </p>
            <div className="summary-line"><span>المجموع الفرعي</span><span>{formatPrice(order.subtotal ?? order.total)}</span></div>
            {order.discount > 0 && <div className="summary-line discount"><span>خصم {order.coupon_code}</span><span>−{formatPrice(order.discount)}</span></div>}
            <div className="summary-line"><span>الشحن</span><span>{order.shipping ? formatPrice(order.shipping) : 'مجاني'}</span></div>
            <div className="summary-line total"><span>الإجمالي</span><span>{formatPrice(order.total)}</span></div>
          </div>
        </div>
        {order.status === 'delivered' && <p className="muted" style={{ marginTop: 20 }}>هل أعجبك ما طلبت؟ يمكنك تقييم المنتجات من صفحة كل منتج.</p>}
      </div>
    </>
  );
}
