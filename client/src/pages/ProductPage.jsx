import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Truck, Money, ShieldCheck, Handbag, CaretLeft, Trash } from '@phosphor-icons/react';
import { api, formatPrice, formatDate, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';
import Stars from '../components/Stars.jsx';
import Stepper from '../components/Stepper.jsx';
import Notice from '../components/Notice.jsx';

function Reviews({ product, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/products/${product.id}/reviews`).then(setReviews).catch(() => {}), [product.id]);
  useEffect(() => { load(); }, [load]);

  const mine = user && reviews.find((r) => r.user_id === user.id);
  useEffect(() => {
    if (mine) { setRating(mine.rating); setComment(mine.comment); }
  }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('اختر عدد النجوم أولاً.');
    setError('');
    try {
      await api(`/products/${product.id}/reviews`, { method: 'POST', body: { rating, comment } });
      toast(mine ? 'حُفظ تعديل تقييمك' : 'شكراً لتقييمك');
      load();
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api(`/products/${product.id}/reviews/${id}`, { method: 'DELETE' });
    setRating(0);
    setComment('');
    load();
    onChange();
  };

  return (
    <section className="reviews" aria-labelledby="reviews-title">
      <div>
        <h2 id="reviews-title">آراء العملاء</h2>
        {product.review_count > 0 ? (
          <div className="rating-summary">
            <strong>{product.avg_rating}</strong>
            <div><Stars value={product.avg_rating} /><div className="muted small num">{product.review_count} تقييم</div></div>
          </div>
        ) : (
          <p className="muted" style={{ margin: '12px 0 20px' }}>لا توجد تقييمات بعد.</p>
        )}
        {user ? (
          <form className="stack" onSubmit={submit}>
            <span className="label">{mine ? 'عدّل تقييمك' : 'قيّم المنتج'}</span>
            <Stars value={rating} onChange={setRating} size={26} />
            <textarea className="input" placeholder="ما رأيك في المنتج؟ (اختياري)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
            {error && <Notice type="error">{error}</Notice>}
            <button className="btn">{mine ? 'حفظ التعديل' : 'نشر التقييم'}</button>
          </form>
        ) : (
          <p className="muted"><Link to="/login">سجّل الدخول</Link> لتقييم المنتجات التي اشتريتها.</p>
        )}
      </div>
      <div className="review-list">
        {reviews.map((r) => (
          <article key={r.id} className="review">
            <div className="review-head">
              <strong>{r.user_name}</strong>
              <Stars value={r.rating} size={14} />
              <span className="muted small">{formatDate(r.created_at)}</span>
              {(user?.id === r.user_id || user?.role === 'admin') && (
                <button className="icon-btn danger" onClick={() => remove(r.id)} aria-label="حذف التقييم" style={{ marginInlineStart: 'auto' }}>
                  <Trash size={18} />
                </button>
              )}
            </div>
            {r.comment && <p>{r.comment}</p>}
          </article>
        ))}
      </div>
    </section>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const { add, items } = useCart();
  const { freeShippingMin, cardPayments } = useConfig();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/products/${id}`).then(setProduct).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <Notice type="error">{error}</Notice>;
  if (!product) {
    return (
      <div className="pdp" aria-busy="true">
        <div className="skeleton" style={{ aspectRatio: '4 / 5' }} />
        <div className="stack"><div className="skeleton" style={{ height: 48 }} /><div className="skeleton" style={{ height: 120 }} /></div>
      </div>
    );
  }

  const inCart = items.find((i) => i.id === product.id)?.quantity || 0;
  const available = product.stock - inCart;
  const low = product.stock > 0 && product.stock <= 3;

  return (
    <>
      <div className="pdp">
        <div className="pdp-media">
          <img src={product.image_url || PLACEHOLDER_IMG} alt={product.name} />
        </div>
        <div className="pdp-info">
          <nav className="crumbs" aria-label="المسار">
            <Link to="/">المنتجات</Link>
            <CaretLeft size={12} />
            <Link to={`/?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          </nav>
          <h1>{product.name}</h1>
          {product.review_count > 0 && (
            <a href="#reviews-title"><Stars value={product.avg_rating} count={product.review_count} /></a>
          )}
          <p className="pdp-price">{formatPrice(product.price)}</p>
          {product.description && <p className="pdp-desc pre-line">{product.description}</p>}
          <p className={`stock-note ${low ? 'low' : ''}`}>
            {product.stock <= 0 ? 'نفد المخزون حالياً' : low ? `متبقٍ ${product.stock} قطع فقط` : 'متوفر'}
            {inCart > 0 && ` · ${inCart} في سلتك`}
          </p>
          {available > 0 ? (
            <div className="buy-row">
              <Stepper value={Math.min(qty, available)} max={available} onChange={setQty} />
              <button className="btn btn-accent btn-lg" onClick={() => { add(product, Math.min(qty, available)); setQty(1); toast('أُضيف إلى السلة'); }}>
                <Handbag size={20} /> أضف إلى السلة
              </button>
            </div>
          ) : (
            product.stock > 0 && <Link to="/cart" className="btn btn-ghost btn-lg">كل الكمية المتاحة في سلتك</Link>
          )}
          <ul className="assurances">
            {freeShippingMin > 0 && <li><Truck size={20} /> شحن مجاني للطلبات فوق {formatPrice(freeShippingMin)}</li>}
            <li><Money size={20} /> الدفع نقداً عند الاستلام</li>
            {cardPayments && <li><ShieldCheck size={20} /> أو ادفع بالبطاقة بأمان عبر Stripe</li>}
          </ul>
        </div>
      </div>
      <Reviews product={product} onChange={load} />
    </>
  );
}
