import { Link } from 'react-router-dom';
import { formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Stars from './Stars.jsx';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const toast = useToast();
  const outOfStock = product.stock <= 0;
  return (
    <article className="card product-card">
      <Link to={`/products/${product.id}`} className="product-img">
        <img src={product.image_url || PLACEHOLDER_IMG} alt={product.name} loading="lazy" />
        {outOfStock && <span className="ribbon">نفد</span>}
      </Link>
      <div className="product-body">
        <span className="chip">{product.category}</span>
        <Link to={`/products/${product.id}`}><h3>{product.name}</h3></Link>
        {product.review_count > 0 && <Stars value={product.avg_rating} count={product.review_count} size="0.9rem" />}
        <div className="product-footer">
          <strong className="price">{formatPrice(product.price)}</strong>
          <button
            className="btn btn-sm"
            disabled={outOfStock}
            onClick={() => { add(product); toast(`تمت إضافة "${product.name}" للسلة`); }}
          >
            {outOfStock ? 'نفد المخزون' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    </article>
  );
}
