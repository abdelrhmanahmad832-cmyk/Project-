import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, formatPrice } from '../api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';

const SORTS = [
  ['newest', 'الأحدث'],
  ['price_asc', 'السعر: من الأقل'],
  ['price_desc', 'السعر: من الأعلى'],
  ['rating', 'الأعلى تقييماً'],
];

export default function Home() {
  const [params, setParams] = useSearchParams();
  const { freeShippingMin } = useConfig();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;
  const inStock = params.get('inStock') === '1';

  const [search, setSearch] = useState(q);
  const [data, setData] = useState({ items: [], pages: 1, total: 0 });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const update = (changes) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) (v ? next.set(k, v) : next.delete(k));
    if (!('page' in changes)) next.delete('page');
    setParams(next, { replace: !('page' in changes) });
  };

  useEffect(() => {
    api('/products/categories').then(setCategories).catch(() => {});
  }, []);

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search }), 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    const query = new URLSearchParams({ sort, page, limit: 12 });
    if (q) query.set('q', q);
    if (category) query.set('category', category);
    if (inStock) query.set('inStock', '1');
    setLoading(true);
    api(`/products?${query}`)
      .then((d) => { setData(d); setError(''); })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, category, sort, page, inStock]);

  return (
    <>
      <section className="hero">
        <h1>تسوّق كل ما تحتاجه في مكان واحد</h1>
        <p>
          منتجات مختارة بعناية، دفع آمن، وتوصيل سريع لباب بيتك.
          {freeShippingMin > 0 && ` شحن مجاني للطلبات فوق ${formatPrice(freeShippingMin)}`}
        </p>
      </section>

      <div className="filters">
        <div className="filter-row">
          <input className="input" type="search" placeholder="ابحث عن منتج..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input select" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="الترتيب">
            {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <label className="check">
            <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : '' })} /> المتوفر فقط
          </label>
        </div>
        <div className="chips">
          <button className={`chip-btn ${!category ? 'active' : ''}`} onClick={() => update({ category: '' })}>الكل</button>
          {categories.map((c) => (
            <button key={c} className={`chip-btn ${category === c ? 'active' : ''}`} onClick={() => update({ category: c })}>{c}</button>
          ))}
        </div>
      </div>

      {error && <p className="alert">{error}</p>}
      {loading ? (
        <div className="grid">{Array.from({ length: 8 }, (_, i) => <div key={i} className="card skeleton" />)}</div>
      ) : data.items.length ? (
        <>
          <p className="muted small">{data.total} منتج</p>
          <div className="grid">{data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          <Pagination page={data.page} pages={data.pages} onChange={(p) => { update({ page: p > 1 ? String(p) : '' }); window.scrollTo(0, 0); }} />
        </>
      ) : (
        <p className="center muted">لا توجد منتجات مطابقة</p>
      )}
    </>
  );
}
