import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductPage() {
  const { id } = useParams();
  const { add } = useCart();
  const [product, setProduct] = useState(null);
  const [qty, setQty] = useState(1);
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);

  useEffect(() => {
    api(`/products/${id}`).then(setProduct).catch((e) => setError(e.message));
  }, [id]);

  if (error) return <p className="alert">{error}</p>;
  if (!product) return <p className="center muted">جارٍ التحميل...</p>;

  return (
    <div className="product-detail card">
      <img src={product.image_url || 'https://placehold.co/600x400?text=No+Image'} alt={product.name} />
      <div className="detail-body">
        <Link to="/" className="muted">← العودة للمنتجات</Link>
        <span className="chip">{product.category}</span>
        <h1>{product.name}</h1>
        <p className="price big">{formatPrice(product.price)}</p>
        <p>{product.description}</p>
        <p className="muted">{product.stock > 0 ? `متوفر: ${product.stock} قطعة` : 'نفد المخزون'}</p>
        {product.stock > 0 && (
          <div className="row">
            <input
              type="number" className="input qty" min="1" max={product.stock} value={qty}
              onChange={(e) => setQty(Math.max(1, Math.min(product.stock, Number(e.target.value) || 1)))}
            />
            <button className="btn" onClick={() => { add(product, qty); setAdded(true); }}>أضف للسلة</button>
          </div>
        )}
        {added && <p className="success">تمت الإضافة للسلة ✓ <Link to="/cart">اذهب للسلة</Link></p>}
      </div>
    </div>
  );
}
