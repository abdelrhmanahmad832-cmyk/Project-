import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatPrice, formatDate, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Stars from '../components/Stars.jsx';

function Reviews({ productId, onChange }) {
  const { user } = useAuth();
  const toast = useToast();
  const [reviews, setReviews] = useState([]);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/products/${productId}/reviews`).then(setReviews).catch(() => {}), [productId]);
  useEffect(() => { load(); }, [load]);

  const mine = user && reviews.find((r) => r.user_id === user.id);
  useEffect(() => {
    if (mine) { setRating(mine.rating); setComment(mine.comment); }
  }, [mine?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) return setError('اختر عدد النجوم');
    setError('');
    try {
      await api(`/products/${productId}/reviews`, { method: 'POST', body: { rating, comment } });
      toast('شكراً لتقييمك!');
      load();
      onChange();
    } catch (err) {
      setError(err.message);
    }
  };

  const remove = async (id) => {
    await api(`/products/${productId}/reviews/${id}`, { method: 'DELETE' });
    setRating(0);
    setComment('');
    load();
    onChange();
  };

  return (
    <section className="card pad reviews">
      <h2>آراء العملاء</h2>
      {user ? (
        <form className="form review-form" onSubmit={submit}>
          <strong>{mine ? 'عدّل تقييمك' : 'قيّم هذا المنتج'}</strong>
          <Stars value={rating} onChange={setRating} size="1.6rem" />
          <textarea className="input" placeholder="اكتب رأيك (اختياري)" maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} />
          {error && <p className="alert">{error}</p>}
          <button className="btn">{mine ? 'حفظ التعديل' : 'إرسال التقييم'}</button>
        </form>
      ) : (
        <p className="muted"><Link to="/login">سجّل الدخول</Link> لتقييم المنتجات التي اشتريتها.</p>
      )}
      {!reviews.length && <p className="muted">لا توجد تقييمات بعد.</p>}
      {reviews.map((r) => (
        <div key={r.id} className="review">
          <div className="row">
            <strong>{r.user_name}</strong>
            <Stars value={r.rating} />
            <span className="muted small">{formatDate(r.created_at)}</span>
            {(user?.id === r.user_id || user?.role === 'admin') && (
              <button className="link-btn danger-text" onClick={() => remove(r.id)}>حذف</button>
            )}
          </div>
          {r.comment && <p>{r.comment}</p>}
        </div>
      ))}
    </section>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const { add, items } = useCart();
  const toast = useToast();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/products/${id}`).then(setProduct).catch((e) => setError(e.message)), [id]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="alert">{error}</p>;
  if (!product) return <p className="center muted">جارٍ التحميل...</p>;

  const inCart = items.find((i) => i.id === product.id)?.quantity || 0;
  const available = product.stock - inCart;

  return (
    <>
      <div className="product-detail card">
        <img src={product.image_url || PLACEHOLDER_IMG} alt={product.name} />
        <div className="detail-body">
          <Link to="/" className="muted">→ العودة للمنتجات</Link>
          <span className="chip">{product.category}</span>
          <h1>{product.name}</h1>
          {product.review_count > 0 && <Stars value={product.avg_rating} count={product.review_count} />}
          <p className="price big">{formatPrice(product.price)}</p>
          <p className="pre-line">{product.description}</p>
          <p className={product.stock > 0 && product.stock <= 3 ? 'danger-text' : 'muted'}>
            {product.stock <= 0 ? 'نفد المخزون' : product.stock <= 3 ? `متبقي ${product.stock} فقط!` : `متوفر: ${product.stock} قطعة`}
          </p>
          {available > 0 ? (
            <div className="row">
              <input
                type="number" className="input qty" min="1" max={available} value={qty} aria-label="الكمية"
                onChange={(e) => setQty(Math.max(1, Math.min(available, Number(e.target.value) || 1)))}
              />
              <button className="btn" onClick={() => { add(product, qty); setQty(1); toast('تمت الإضافة للسلة ✓'); }}>أضف للسلة</button>
              {inCart > 0 && <Link to="/cart" className="btn btn-ghost">في السلة ({inCart})</Link>}
            </div>
          ) : (
            product.stock > 0 && <Link to="/cart" className="btn btn-ghost">كل الكمية المتاحة في سلتك</Link>
          )}
        </div>
      </div>
      <Reviews productId={product.id} onChange={load} />
    </>
  );
}
