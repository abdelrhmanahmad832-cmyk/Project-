import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Check } from '@phosphor-icons/react';
import { formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Stars from './Stars.jsx';

export default function ProductCard({ product }) {
  const { add } = useCart();
  const toast = useToast();
  const [added, setAdded] = useState(false);
  const soldOut = product.stock <= 0;
  const low = !soldOut && product.stock <= 3;

  useEffect(() => {
    if (!added) return;
    const t = setTimeout(() => setAdded(false), 1400);
    return () => clearTimeout(t);
  }, [added]);

  const onAdd = () => {
    add(product);
    setAdded(true);
    toast(`أُضيف "${product.name}" إلى السلة`);
  };

  return (
    <article className="product">
      <div className="product-media-wrap">
        <Link to={`/products/${product.id}`} className={`product-media ${soldOut ? 'soldout' : ''}`} tabIndex={-1} aria-hidden="true">
          <img src={product.image_url || PLACEHOLDER_IMG} alt="" loading="lazy" />
          {soldOut && <span className="product-flag">نفد المخزون</span>}
          {low && <span className="product-flag low">آخر {product.stock} قطع</span>}
        </Link>
        {!soldOut && (
          <button className={`product-add ${added ? 'done' : ''}`} onClick={onAdd} aria-label={`أضف ${product.name} إلى السلة`}>
            {added ? <Check size={20} weight="bold" /> : <Plus size={20} weight="bold" />}
          </button>
        )}
      </div>
      <div className="product-info">
        <span className="product-cat">{product.category}</span>
        <Link to={`/products/${product.id}`} className="product-name">{product.name}</Link>
        <div className="product-meta">
          <span className="price">{formatPrice(product.price)}</span>
          {product.review_count > 0 && <Stars value={product.avg_rating} size={13} />}
        </div>
      </div>
    </article>
  );
}
