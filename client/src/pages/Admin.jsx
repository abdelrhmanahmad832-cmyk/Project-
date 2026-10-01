import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api, uploadImage, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, PLACEHOLDER_IMG,
} from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Pagination from '../components/Pagination.jsx';

const EMPTY_PRODUCT = { name: '', description: '', price: '', stock: '', category: '', image_url: '' };

function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api('/orders/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return null;
  return (
    <div className="stats">
      <div className="card stat"><span>الإيرادات</span><strong>{formatPrice(stats.revenue)}</strong></div>
      <div className="card stat"><span>الطلبات</span><strong>{stats.orders}</strong>{stats.pending > 0 && <small className="warn-text">{stats.pending} بانتظار التجهيز</small>}</div>
      <div className="card stat"><span>المنتجات</span><strong>{stats.products}</strong>{stats.low_stock > 0 && <small className="danger-text">{stats.low_stock} مخزونها منخفض</small>}</div>
      <div className="card stat"><span>العملاء</span><strong>{stats.customers}</strong></div>
    </div>
  );
}

function ImagePicker({ value, onChange }) {
  const toast = useToast();
  const inputRef = useRef();
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const { url } = await uploadImage(file);
      onChange(url);
    } catch (err) {
      toast(err.message, 'error');
    }
    setUploading(false);
  };

  return (
    <div className="image-picker span-2">
      <span className="label">صورة المنتج</span>
      <div className="row">
        <img src={value || PLACEHOLDER_IMG} alt="" className="image-preview" />
        <div className="form" style={{ flex: 1 }}>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pick} />
          <div className="row">
            <button type="button" className="btn btn-ghost" disabled={uploading} onClick={() => inputRef.current.click()}>
              {uploading ? 'جارٍ الرفع...' : '📷 رفع صورة من جهازك'}
            </button>
            {value && <button type="button" className="link-btn danger-text" onClick={() => onChange('')}>إزالة</button>}
          </div>
          <input className="input" type="url" dir="ltr" placeholder="أو الصق رابط صورة https://..." value={value.startsWith('/uploads/') ? '' : value} onChange={(e) => onChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}

function ProductsTab() {
  const toast = useToast();
  const [data, setData] = useState({ items: [], page: 1, pages: 1 });
  const [page, setPage] = useState(1);
  const [q, setQ] = useState('');
  const [form, setForm] = useState(EMPTY_PRODUCT);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(
    () => api(`/products?limit=20&page=${page}${q ? `&q=${encodeURIComponent(q)}` : ''}`).then(setData).catch((e) => setError(e.message)),
    [page, q]
  );
  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const reset = () => { setForm(EMPTY_PRODUCT); setEditingId(null); setError(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const body = { ...form, price: Number(form.price), stock: Number(form.stock || 0) };
    try {
      if (editingId) await api(`/products/${editingId}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
      toast(editingId ? 'تم حفظ التعديلات' : 'تمت إضافة المنتج');
      reset();
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const edit = (p) => {
    setEditingId(p.id);
    setForm({ name: p.name, description: p.description, price: p.price, stock: p.stock, category: p.category, image_url: p.image_url });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const del = async (p) => {
    if (!confirm(`حذف "${p.name}"؟`)) return;
    try {
      await api(`/products/${p.id}`, { method: 'DELETE' });
      toast('تم حذف المنتج');
      if (editingId === p.id) reset();
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <form className="card pad form" onSubmit={submit}>
        <h3>{editingId ? `تعديل المنتج #${editingId}` : 'إضافة منتج جديد'}</h3>
        {error && <p className="alert">{error}</p>}
        <div className="form-grid">
          <label>الاسم<input className="input" required value={form.name} onChange={set('name')} /></label>
          <label>التصنيف<input className="input" value={form.category} onChange={set('category')} placeholder="عام" /></label>
          <label>السعر<input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
          <label>المخزون<input className="input" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} /></label>
          <ImagePicker value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          <label className="span-2">الوصف<textarea className="input" value={form.description} onChange={set('description')} /></label>
        </div>
        <div className="row">
          <button className="btn">{editingId ? 'حفظ التعديلات' : 'إضافة'}</button>
          {editingId && <button type="button" className="btn btn-ghost" onClick={reset}>إلغاء</button>}
        </div>
      </form>

      <div className="card pad">
        <input className="input" type="search" placeholder="ابحث في المنتجات..." value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        <table className="table">
          <thead><tr><th></th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>التقييم</th><th></th></tr></thead>
          <tbody>
            {data.items.map((p) => (
              <tr key={p.id}>
                <td><img src={p.image_url || PLACEHOLDER_IMG} alt="" className="thumb" /></td>
                <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                <td>{p.category}</td>
                <td>{formatPrice(p.price)}</td>
                <td className={p.stock <= 3 ? 'danger-text' : ''}>{p.stock}</td>
                <td>{p.review_count ? `★ ${p.avg_rating} (${p.review_count})` : '—'}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>تعديل</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(p)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={data.page} pages={data.pages} onChange={setPage} />
      </div>
    </>
  );
}

function OrdersTab() {
  const toast = useToast();
  const [orders, setOrders] = useState([]);
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(() => api(`/orders${filter ? `?status=${filter}` : ''}`).then(setOrders).catch((e) => setError(e.message)), [filter]);
  useEffect(() => { load(); }, [load]);

  const changeStatus = async (o, status) => {
    if (status === 'cancelled' && !confirm(o.payment_status === 'paid' ? 'إلغاء الطلب سيعيد المبلغ للعميل تلقائياً. متابعة؟' : 'إلغاء الطلب؟')) return;
    try {
      await api(`/orders/${o.id}/status`, { method: 'PATCH', body: { status } });
      toast('تم تحديث حالة الطلب');
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="chips">
        <button className={`chip-btn ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>الكل</button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button key={k} className={`chip-btn ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{v}</button>
        ))}
      </div>
      {error && <p className="alert">{error}</p>}
      {!orders.length && <p className="muted center">لا توجد طلبات.</p>}
      {orders.map((o) => (
        <div key={o.id} className="card pad order">
          <div className="order-head">
            <strong>طلب #{o.id}</strong>
            <span>{o.customer_name} <span className="muted small" dir="ltr">({o.customer_email})</span></span>
            <span className="muted small">{formatDate(o.created_at)}</span>
            <span className={`status pay-${o.payment_status}`}>{PAYMENT_METHOD_LABELS[o.payment_method]} · {PAYMENT_STATUS_LABELS[o.payment_status]}</span>
            <select
              className="input select" value={o.status} disabled={o.status === 'cancelled'} aria-label="حالة الطلب"
              onChange={(e) => changeStatus(o, e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p className="muted">📍 {o.address} — 📞 <span dir="ltr">{o.phone}</span></p>
          <ul>
            {o.items.map((i) => <li key={i.id}>{i.product_name} × {i.quantity} — {formatPrice(i.unit_price * i.quantity)}</li>)}
          </ul>
          <strong>الإجمالي: {formatPrice(o.total)}</strong>
          {o.discount > 0 && <span className="muted small"> (خصم {formatPrice(o.discount)} بكود {o.coupon_code})</span>}
        </div>
      ))}
    </>
  );
}

const EMPTY_COUPON = { code: '', type: 'percent', value: '', min_total: '', max_uses: '', expires_at: '' };

function CouponsTab() {
  const toast = useToast();
  const [coupons, setCoupons] = useState([]);
  const [form, setForm] = useState(EMPTY_COUPON);
  const [error, setError] = useState('');

  const load = () => api('/coupons').then(setCoupons).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/coupons', { method: 'POST', body: form });
      toast('تم إنشاء كود الخصم');
      setForm(EMPTY_COUPON);
      load();
    } catch (err) {
      setError(err.message);
    }
  };

  const toggle = async (c) => {
    await api(`/coupons/${c.id}`, { method: 'PATCH', body: { active: !c.active } });
    load();
  };
  const del = async (c) => {
    if (!confirm(`حذف الكود ${c.code}؟`)) return;
    await api(`/coupons/${c.id}`, { method: 'DELETE' });
    load();
  };

  return (
    <>
      <form className="card pad form" onSubmit={submit}>
        <h3>كود خصم جديد</h3>
        {error && <p className="alert">{error}</p>}
        <div className="form-grid">
          <label>الكود<input className="input" dir="ltr" required placeholder="SUMMER20" value={form.code} onChange={set('code')} /></label>
          <label>النوع
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="percent">نسبة مئوية %</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </label>
          <label>القيمة<input className="input" type="number" min="0.01" step="0.01" max={form.type === 'percent' ? 100 : undefined} required value={form.value} onChange={set('value')} /></label>
          <label>الحد الأدنى للطلب<input className="input" type="number" min="0" step="0.01" placeholder="0" value={form.min_total} onChange={set('min_total')} /></label>
          <label>أقصى عدد استخدامات<input className="input" type="number" min="1" step="1" placeholder="بلا حد" value={form.max_uses} onChange={set('max_uses')} /></label>
          <label>تاريخ الانتهاء<input className="input" type="date" value={form.expires_at} onChange={set('expires_at')} /></label>
        </div>
        <div><button className="btn">إنشاء</button></div>
      </form>
      <div className="card pad">
        <table className="table">
          <thead><tr><th>الكود</th><th>الخصم</th><th>الحد الأدنى</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th></th></tr></thead>
          <tbody>
            {coupons.map((c) => (
              <tr key={c.id}>
                <td dir="ltr" className="text-start"><code>{c.code}</code></td>
                <td>{c.type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</td>
                <td>{c.min_total ? formatPrice(c.min_total) : '—'}</td>
                <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                <td>{c.expires_at || '—'}</td>
                <td><button className={`chip-btn ${c.active ? 'active' : ''}`} onClick={() => toggle(c)}>{c.active ? 'مفعّل' : 'معطّل'}</button></td>
                <td><button className="btn btn-danger btn-sm" onClick={() => del(c)}>حذف</button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!coupons.length && <p className="muted center">لا توجد أكواد خصم بعد.</p>}
      </div>
    </>
  );
}

function UsersTab() {
  const { user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const load = () => api('/users').then(setUsers).catch((e) => toast(e.message, 'error'));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const setRole = async (u, role) => {
    if (!confirm(role === 'admin' ? `منح ${u.name} صلاحيات المدير؟` : `إزالة صلاحيات المدير من ${u.name}؟`)) return;
    try {
      await api(`/users/${u.id}/role`, { method: 'PATCH', body: { role } });
      load();
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  return (
    <div className="card pad">
      <table className="table">
        <thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الطلبات</th><th>إجمالي المشتريات</th><th>تاريخ التسجيل</th><th>الصلاحية</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td dir="ltr" className="text-start">{u.email}</td>
              <td dir="ltr" className="text-start">{u.phone || '—'}</td>
              <td>{u.orders_count}</td>
              <td>{formatPrice(u.total_spent)}</td>
              <td>{formatDate(u.created_at)}</td>
              <td>
                {u.id === me.id ? (
                  <span className="chip">مدير (أنت)</span>
                ) : u.role === 'admin' ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRole(u, 'customer')}>مدير ✕</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRole(u, 'admin')}>ترقية لمدير</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const TABS = { products: ['المنتجات', ProductsTab], orders: ['الطلبات', OrdersTab], coupons: ['أكواد الخصم', CouponsTab], users: ['المستخدمون', UsersTab] };

export default function Admin() {
  const [tab, setTab] = useState('products');
  const Tab = TABS[tab][1];
  return (
    <>
      <h2>لوحة التحكم</h2>
      <Stats />
      <div className="tabs">
        {Object.entries(TABS).map(([k, [label]]) => (
          <button key={k} className={`chip-btn ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <Tab />
    </>
  );
}
