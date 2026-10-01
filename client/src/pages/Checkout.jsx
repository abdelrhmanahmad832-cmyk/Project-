import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { CreditCard, Money, Lock } from '@phosphor-icons/react';
import { api, formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';
import Notice from '../components/Notice.jsx';
import Empty from '../components/Empty.jsx';

export default function Checkout() {
  const { items, clear } = useCart();
  const { user, setUser } = useAuth();
  const { cardPayments } = useConfig();
  const navigate = useNavigate();
  const [address, setAddress] = useState(user.address || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [saveInfo, setSaveInfo] = useState(!user.address);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [couponInput, setCouponInput] = useState('');
  const [coupon, setCoupon] = useState('');
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const lines = items.map((i) => ({ productId: i.id, quantity: i.quantity }));
  const linesKey = JSON.stringify(lines);

  useEffect(() => {
    if (!lines.length) return;
    api('/orders/quote', { method: 'POST', body: { items: lines, couponCode: coupon } })
      .then((q) => { setQuote(q); setError(''); })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesKey, coupon]);

  useEffect(() => {
    if (cardPayments) setPaymentMethod('card');
  }, [cardPayments]);

  if (!items.length && !submitting) {
    return <Empty title="لا يوجد ما تدفع ثمنه" action={<Link to="/" className="btn">تصفّح المنتجات</Link>}>سلتك فارغة.</Empty>;
  }

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      if (saveInfo) {
        api('/auth/me', { method: 'PUT', body: { address, phone } }).then((r) => setUser(r.user)).catch(() => {});
      }
      const { order, checkoutUrl } = await api('/orders', {
        method: 'POST',
        body: { address, phone, items: lines, paymentMethod, couponCode: quote?.couponCode || undefined },
      });
      if (checkoutUrl) {
        clear();
        window.location.assign(checkoutUrl);
        return;
      }
      clear();
      navigate(`/orders/${order.id}`, { state: { placed: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="page-head"><h1>إتمام الطلب</h1></div>
      <form className="split" onSubmit={submit}>
        <div className="panel">
          <section className="form-section">
            <h2>عنوان التوصيل</h2>
            <div className="form-grid">
              <label className="field span-2"><span>العنوان بالتفصيل</span>
                <textarea className="input" required autoComplete="street-address" placeholder="المدينة، الحي، الشارع، رقم المبنى" value={address} onChange={(e) => setAddress(e.target.value)} />
              </label>
              <label className="field"><span>رقم الهاتف</span>
                <input className="input" type="tel" dir="ltr" required autoComplete="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              </label>
              <label className="check span-2"><input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} /> احفظ العنوان ورقم الهاتف للطلبات القادمة</label>
            </div>
          </section>

          <section className="form-section">
            <h2>طريقة الدفع</h2>
            <div className="pay-options" role="radiogroup" aria-label="طريقة الدفع">
              {cardPayments && (
                <label className="pay-option">
                  <input type="radio" name="pay" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
                  <span className="pay-icon"><CreditCard size={22} /></span>
                  <div><strong>بطاقة ائتمان أو خصم</strong><small>تُحوَّل إلى صفحة دفع Stripe الآمنة</small></div>
                </label>
              )}
              <label className="pay-option">
                <input type="radio" name="pay" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
                <span className="pay-icon"><Money size={22} /></span>
                <div><strong>الدفع عند الاستلام</strong><small>ادفع نقداً عند وصول الطلب</small></div>
              </label>
            </div>
          </section>
        </div>

        <aside className="panel aside-sticky">
          <h2 className="panel-title">ملخص الطلب</h2>
          <div className="summary-items">
            {items.map((i) => (
              <div key={i.id} className="summary-item">
                <img src={i.image_url || PLACEHOLDER_IMG} alt="" />
                <div><div>{i.name}</div><div className="qty num">× {i.quantity}</div></div>
                <span className="num">{formatPrice(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <hr />
          <div className="coupon-row">
            <label className="visually-hidden" htmlFor="coupon">كود الخصم</label>
            <input id="coupon" className="input" placeholder="كود الخصم" dir="ltr" value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); setCoupon(couponInput.trim()); } }} />
            <button type="button" className="btn btn-ghost" disabled={!couponInput.trim()} onClick={() => setCoupon(couponInput.trim())}>تطبيق</button>
          </div>
          {quote?.couponError && <div style={{ marginTop: 10 }}><Notice type="error">{quote.couponError}</Notice></div>}
          <hr />
          {quote ? (
            <>
              <div className="summary-line"><span>المجموع الفرعي</span><span>{formatPrice(quote.subtotal)}</span></div>
              {quote.discount > 0 && (
                <div className="summary-line discount">
                  <span>خصم {quote.couponCode} <button type="button" className="link-btn" onClick={() => { setCoupon(''); setCouponInput(''); }}>إزالة</button></span>
                  <span>−{formatPrice(quote.discount)}</span>
                </div>
              )}
              <div className="summary-line"><span>الشحن</span><span>{quote.shipping ? formatPrice(quote.shipping) : 'مجاني'}</span></div>
              <div className="summary-line total"><span>الإجمالي</span><span>{formatPrice(quote.total)}</span></div>
            </>
          ) : (
            <div className="skeleton" style={{ height: 96 }} />
          )}
          {error && <div style={{ marginTop: 12 }}><Notice type="error">{error}</Notice></div>}
          <button className="btn btn-accent btn-lg btn-block" style={{ marginTop: 18 }} disabled={submitting || !quote}>
            {submitting ? 'جارٍ المعالجة…' : paymentMethod === 'card' ? <><Lock size={18} /> ادفع {quote ? formatPrice(quote.total) : ''}</> : 'تأكيد الطلب'}
          </button>
        </aside>
      </form>
    </>
  );
}
