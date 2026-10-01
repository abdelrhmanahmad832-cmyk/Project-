import { Link } from 'react-router-dom';
import { formatPrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const outOfStock = product.stock <= 0;
  return (
    <article className="card product-card">
      <Link to={`/products/${product.id}`} className="product-img">
        <img src={product.image_url || 'https://placehold.co/600x400?text=No+Image'} alt={product.name} loading="lazy" />
      </Link>
      <div className="product-body">
        <span className="chip">{product.category}</span>
        <Link to={`/products/${product.id}`}><h3>{product.name}</h3></Link>
        <div className="product-footer">
          <strong className="price">{formatPrice(product.price)}</strong>
          <button className="btn" disabled={outOfStock} onClick={() => add(product)}>
            {outOfStock ? 'نفد المخزون' : 'أضف للسلة'}
          </button>
        </div>
      </div>
    </article>
  );
}
