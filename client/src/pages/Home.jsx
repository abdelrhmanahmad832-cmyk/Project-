import { useEffect, useState } from 'react';
import { api } from '../api.js';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/products/categories').then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('category', category);
    const t = setTimeout(() => {
      setLoading(true);
      api(`/products?${params}`)
        .then((data) => { setProducts(data); setError(''); })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [q, category]);

  return (
    <>
      <section className="hero">
        <h1>تسوّق كل ما تحتاجه في مكان واحد</h1>
        <p>منتجات مختارة بعناية، أسعار مناسبة، وتوصيل سريع لباب بيتك.</p>
      </section>

      <div className="filters">
        <input className="input" placeholder="ابحث عن منتج..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          <button className={`chip-btn ${!category ? 'active' : ''}`} onClick={() => setCategory('')}>الكل</button>
          {categories.map((c) => (
            <button key={c} className={`chip-btn ${category === c ? 'active' : ''}`} onClick={() => setCategory(c)}>{c}</button>
          ))}
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {loading ? (
        <p className="center muted">جارٍ التحميل...</p>
      ) : products.length ? (
        <div className="grid">{products.map((p) => <ProductCard key={p.id} product={p} />)}</div>
      ) : (
        <p className="center muted">لا توجد منتجات مطابقة</p>
      )}
    </>
  );
}
