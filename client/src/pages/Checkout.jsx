import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';

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

  if (!items.length) return <p className="center muted">السلة فارغة. <Link to="/">تصفح المنتجات</Link></p>;

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
      clear();
      if (checkoutUrl) {
        window.location.assign(checkoutUrl);
        return;
      }
      navigate(`/orders/${order.id}`, { state: { placed: true } });
    } catch (err) {
      setError(err.message);
      setSubmitting(false);
    }
  };

  return (
    <div className="checkout">
      <form className="card pad form" onSubmit={submit}>
        <h2>بيانات التوصيل</h2>
        <label>العنوان<textarea className="input" required value={address} onChange={(e) => setAddress(e.target.value)} /></label>
        <label>رقم الهاتف<input className="input" type="tel" dir="ltr" required value={phone} onChange={(e) => setPhone(e.target.value)} /></label>
        <label className="check"><input type="checkbox" checked={saveInfo} onChange={(e) => setSaveInfo(e.target.checked)} /> احفظ العنوان ورقم الهاتف لطلباتي القادمة</label>

        <h3>طريقة الدفع</h3>
        <div className="pay-options">
          {cardPayments && (
            <label className={`pay-option ${paymentMethod === 'card' ? 'selected' : ''}`}>
              <input type="radio" name="pay" value="card" checked={paymentMethod === 'card'} onChange={() => setPaymentMethod('card')} />
              <span>💳 بطاقة ائتمان / خصم<small className="muted">دفع آمن عبر Stripe</small></span>
            </label>
          )}
          <label className={`pay-option ${paymentMethod === 'cod' ? 'selected' : ''}`}>
            <input type="radio" name="pay" value="cod" checked={paymentMethod === 'cod'} onChange={() => setPaymentMethod('cod')} />
            <span>💵 الدفع عند الاستلام<small className="muted">ادفع نقداً عند وصول طلبك</small></span>
          </label>
        </div>

        {error && <p className="alert">{error}</p>}
        <button className="btn btn-lg" disabled={submitting || !quote}>
          {submitting ? 'جارٍ المعالجة...' : paymentMethod === 'card' ? `ادفع ${quote ? formatPrice(quote.total) : ''}` : 'تأكيد الطلب'}
        </button>
      </form>

      <aside className="card pad">
        <h3>ملخص الطلب</h3>
        {items.map((i) => (
          <div key={i.id} className="summary-line"><span>{i.name} × {i.quantity}</span><span>{formatPrice(i.price * i.quantity)}</span></div>
        ))}
        <hr />
        <form className="row coupon-row" onSubmit={(e) => { e.preventDefault(); setCoupon(couponInput.trim()); }}>
          <input className="input" placeholder="كود الخصم" dir="ltr" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} />
          <button className="btn btn-ghost" disabled={!couponInput.trim()}>تطبيق</button>
        </form>
        {quote?.couponError && <p className="alert small">{quote.couponError}</p>}
        {quote && (
          <>
            <div className="summary-line"><span>المجموع الفرعي</span><span>{formatPrice(quote.subtotal)}</span></div>
            {quote.discount > 0 && (
              <div className="summary-line success-text">
                <span>
                  خصم ({quote.couponCode})
                  <button type="button" className="link-btn" onClick={() => { setCoupon(''); setCouponInput(''); }}>إزالة</button>
                </span>
                <span>−{formatPrice(quote.discount)}</span>
              </div>
            )}
            <div className="summary-line"><span>الشحن</span><span>{quote.shipping ? formatPrice(quote.shipping) : 'مجاني'}</span></div>
            <hr />
            <div className="summary-line total"><strong>الإجمالي</strong><strong>{formatPrice(quote.total)}</strong></div>
          </>
        )}
      </aside>
    </div>
  );
}
