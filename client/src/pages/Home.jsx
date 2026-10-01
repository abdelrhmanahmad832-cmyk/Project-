import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MagnifyingGlass, Truck, Money, ShieldCheck, ArrowLeft, Package } from '@phosphor-icons/react';
import { api, formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useConfig } from '../context/ConfigContext.jsx';
import ProductCard from '../components/ProductCard.jsx';
import Pagination from '../components/Pagination.jsx';
import Empty from '../components/Empty.jsx';
import Notice from '../components/Notice.jsx';

const SORTS = [
  ['newest', 'الأحدث'],
  ['price_asc', 'السعر: الأقل أولاً'],
  ['price_desc', 'السعر: الأعلى أولاً'],
  ['rating', 'الأعلى تقييماً'],
];

function Hero() {
  const { freeShippingMin, cardPayments } = useConfig();
  const [featured, setFeatured] = useState(null);

  useEffect(() => {
    api('/products?sort=price_desc&limit=3&inStock=1').then((d) => setFeatured(d.items)).catch(() => setFeatured([]));
  }, []);

  return (
    <section className="hero" aria-labelledby="hero-title">
      <div>
        <h1 id="hero-title" className="reveal" style={{ '--i': 0 }}>
          كل ما تحتاجه،<br /><em>مختار بعناية.</em>
        </h1>
        <p className="hero-lede reveal" style={{ '--i': 1 }}>
          إلكترونيات وأزياء وأدوات منزلية اخترناها لجودتها، بأسعار واضحة وتوصيل حتى باب بيتك.
        </p>
        <div className="hero-actions reveal" style={{ '--i': 2 }}>
          <a href="#catalog" className="btn btn-accent btn-lg">تصفّح المنتجات <ArrowLeft size={18} /></a>
        </div>
        <ul className="hero-facts reveal" style={{ '--i': 3 }}>
          {freeShippingMin > 0 && <li><Truck size={20} /> شحن مجاني فوق {formatPrice(freeShippingMin)}</li>}
          <li><Money size={20} /> الدفع عند الاستلام</li>
          {cardPayments && <li><ShieldCheck size={20} /> دفع آمن بالبطاقة</li>}
        </ul>
      </div>
      <div className="hero-gallery">
        {featured
          ? featured.map((p, i) => (
              <Link key={p.id} to={`/products/${p.id}`} className="reveal" style={{ '--i': i + 1 }}>
                <img src={p.image_url || PLACEHOLDER_IMG} alt={p.name} />
                <span>{p.name}</span>
              </Link>
            ))
          : [0, 1, 2].map((i) => <div key={i} className="skeleton" style={i === 0 ? { gridRow: 'span 2' } : undefined} />)}
      </div>
    </section>
  );
}

export default function Home() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const sort = params.get('sort') || 'newest';
  const page = Number(params.get('page')) || 1;
  const inStock = params.get('inStock') === '1';
  const filtered = !!(q || category || inStock || page > 1 || sort !== 'newest');

  const [search, setSearch] = useState(q);
  const [data, setData] = useState(null);
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

  // Keep the box in sync when the URL changes from elsewhere (back button, links).
  useEffect(() => setSearch(q), [q]);

  // Debounce the search box into the URL.
  useEffect(() => {
    if (search === q) return;
    const t = setTimeout(() => update({ q: search.trim() }), 300);
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

  const goToPage = (p) => {
    update({ page: p > 1 ? String(p) : '' });
    document.getElementById('catalog')?.scrollIntoView({ block: 'start' });
  };

  return (
    <>
      {!filtered && <Hero />}

      <section id="catalog" aria-labelledby="catalog-title">
        <div className="catalog-head">
          <h2 id="catalog-title">{category || 'كل المنتجات'}</h2>
        </div>
        <div className="tabs-line" role="group" aria-label="التصنيفات">
          <button aria-pressed={!category} onClick={() => update({ category: '' })}>الكل</button>
          {categories.map((c) => (
            <button key={c} aria-pressed={category === c} onClick={() => update({ category: c })}>{c}</button>
          ))}
        </div>
        <div className="toolbar">
          <label className="input-icon">
            <span className="visually-hidden">ابحث عن منتج</span>
            <MagnifyingGlass size={18} />
            <input className="input" type="search" placeholder="ابحث عن منتج" value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            <span className="visually-hidden">الترتيب</span>
            <select className="input" value={sort} onChange={(e) => update({ sort: e.target.value === 'newest' ? '' : e.target.value })} aria-label="الترتيب">
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className="check">
            <input type="checkbox" checked={inStock} onChange={(e) => update({ inStock: e.target.checked ? '1' : '' })} /> المتوفر فقط
          </label>
        </div>

        {error && <Notice type="error">{error}</Notice>}
        {loading && !data ? (
          <div className="grid" style={{ marginTop: 24 }} aria-busy="true">
            {Array.from({ length: 8 }, (_, i) => <div key={i} className="skeleton" style={{ aspectRatio: '4 / 6' }} />)}
          </div>
        ) : data?.items.length ? (
          <>
            <p className="result-count num">{data.total} منتج</p>
            <div className="grid" aria-busy={loading}>{data.items.map((p) => <ProductCard key={p.id} product={p} />)}</div>
            <Pagination page={data.page} pages={data.pages} onChange={goToPage} />
          </>
        ) : (
          <Empty
            icon={Package}
            title="لا توجد منتجات مطابقة"
            action={filtered && <button className="btn btn-ghost" onClick={() => setParams({})}>عرض كل المنتجات</button>}
          >
            جرّب كلمة بحث أخرى أو تصنيفاً مختلفاً.
          </Empty>
        )}
      </section>
    </>
  );
}
