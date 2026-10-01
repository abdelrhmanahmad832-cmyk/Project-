import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  api, uploadImage, formatPrice, formatDate, STATUS_LABELS, PAYMENT_STATUS_LABELS, PAYMENT_METHOD_LABELS, PLACEHOLDER_IMG,
} from '../api.js';
import { Camera, PencilSimple, Trash, MagnifyingGlass, MapPin, Phone } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext.jsx';
import Notice from '../components/Notice.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Pagination from '../components/Pagination.jsx';

const EMPTY_PRODUCT = { name: '', description: '', price: '', stock: '', category: '', image_url: '' };

function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api('/orders/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return null;
  return (
    <div className="stats">
      <div className="stat"><span>الإيرادات</span><strong>{formatPrice(stats.revenue)}</strong></div>
      <div className="stat"><span>الطلبات</span><strong>{stats.orders}</strong>{stats.pending > 0 && <small className="low-text">{stats.pending} بانتظار التجهيز</small>}</div>
      <div className="stat"><span>المنتجات</span><strong>{stats.products}</strong>{stats.low_stock > 0 && <small className="low-text">{stats.low_stock} مخزونها منخفض</small>}</div>
      <div className="stat"><span>العملاء</span><strong>{stats.customers}</strong></div>
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
    <div className="field span-2">
      <span>صورة المنتج</span>
      <div className="image-picker">
        <img src={value || PLACEHOLDER_IMG} alt="" className="image-preview" />
        <div className="stack">
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden onChange={pick} />
          <div className="row">
            <button type="button" className="btn btn-ghost" disabled={uploading} onClick={() => inputRef.current.click()}>
              <Camera size={18} /> {uploading ? 'جارٍ الرفع…' : 'رفع صورة من جهازك'}
            </button>
            {value && <button type="button" className="link-btn danger" onClick={() => onChange('')}>إزالة الصورة</button>}
          </div>
          <input className="input" type="url" dir="ltr" placeholder="أو الصق رابط صورة https://…" value={value.startsWith('/uploads/') ? '' : value} onChange={(e) => onChange(e.target.value)} aria-label="رابط الصورة" />
          <span className="hint muted small">JPG أو PNG أو WEBP، حتى 5 ميجابايت</span>
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
      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title">{editingId ? `تعديل المنتج #${editingId}` : 'إضافة منتج'}</h2>
        {error && <div style={{ marginBottom: 16 }}><Notice type="error">{error}</Notice></div>}
        <div className="form-grid">
          <label className="field"><span>اسم المنتج</span><input className="input" required value={form.name} onChange={set('name')} /></label>
          <label className="field"><span>التصنيف</span><input className="input" value={form.category} onChange={set('category')} placeholder="عام" /></label>
          <label className="field"><span>السعر</span><input className="input" type="number" inputMode="decimal" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
          <label className="field"><span>الكمية في المخزون</span><input className="input" type="number" inputMode="numeric" min="0" step="1" value={form.stock} onChange={set('stock')} /></label>
          <ImagePicker value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
          <label className="field span-2"><span>الوصف</span><textarea className="input" value={form.description} onChange={set('description')} /></label>
        </div>
        <div className="row" style={{ marginTop: 20 }}>
          <button className="btn">{editingId ? 'حفظ التعديلات' : 'إضافة المنتج'}</button>
          {editingId && <button type="button" className="btn btn-quiet" onClick={reset}>إلغاء</button>}
        </div>
      </form>

      <div className="panel">
        <label className="input-icon" style={{ display: 'block', marginBottom: 12 }}>
          <span className="visually-hidden">ابحث في المنتجات</span>
          <MagnifyingGlass size={18} />
          <input className="input" type="search" placeholder="ابحث في المنتجات" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
        </label>
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th><span className="visually-hidden">صورة</span></th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th>التقييم</th><th><span className="visually-hidden">إجراءات</span></th></tr></thead>
            <tbody>
              {data.items.map((p) => (
                <tr key={p.id}>
                  <td><img src={p.image_url || PLACEHOLDER_IMG} alt="" className="thumb" /></td>
                  <td><Link to={`/products/${p.id}`}>{p.name}</Link></td>
                  <td className="muted">{p.category}</td>
                  <td>{formatPrice(p.price)}</td>
                  <td className={p.stock <= 3 ? 'low-text' : ''}>{p.stock}</td>
                  <td className="muted">{p.review_count ? `${p.avg_rating} (${p.review_count})` : '—'}</td>
                  <td>
                    <div className="actions">
                      <button className="icon-btn" onClick={() => edit(p)} aria-label={`تعديل ${p.name}`}><PencilSimple size={18} /></button>
                      <button className="icon-btn danger" onClick={() => del(p)} aria-label={`حذف ${p.name}`}><Trash size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
      <div className="tabs-line" role="group" aria-label="تصفية حسب الحالة" style={{ marginBottom: 16 }}>
        <button aria-pressed={!filter} onClick={() => setFilter('')}>الكل</button>
        {Object.entries(STATUS_LABELS).map(([k, v]) => (
          <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)}>{v}</button>
        ))}
      </div>
      {error && <Notice type="error">{error}</Notice>}
      {!orders.length && <p className="muted" style={{ padding: '32px 0', textAlign: 'center' }}>لا توجد طلبات بهذه الحالة.</p>}
      {orders.map((o) => (
        <div key={o.id} className="panel admin-order">
          <div className="admin-order-head">
            <strong className="num">طلب #{o.id}</strong>
            <span>{o.customer_name} <span className="muted small" dir="ltr">{o.customer_email}</span></span>
            <span className="muted small">{formatDate(o.created_at)}</span>
            <span className={`badge pay-${o.payment_status}`}>{PAYMENT_METHOD_LABELS[o.payment_method]} · {PAYMENT_STATUS_LABELS[o.payment_status]}</span>
            <select
              className="input" value={o.status} disabled={o.status === 'cancelled'} aria-label={`حالة الطلب ${o.id}`}
              onChange={(e) => changeStatus(o, e.target.value)}
            >
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p className="muted small row" style={{ gap: 16 }}>
            <span className="row" style={{ gap: 6 }}><MapPin size={16} />{o.address}</span>
            <span className="row" style={{ gap: 6 }}><Phone size={16} /><span dir="ltr">{o.phone}</span></span>
          </p>
          <ul>
            {o.items.map((i) => <li key={i.id}>{i.product_name} × {i.quantity} — <span className="num">{formatPrice(i.unit_price * i.quantity)}</span></li>)}
          </ul>
          <strong className="num">الإجمالي: {formatPrice(o.total)}</strong>
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
      <form className="panel" onSubmit={submit}>
        <h2 className="panel-title">كود خصم جديد</h2>
        {error && <div style={{ marginBottom: 16 }}><Notice type="error">{error}</Notice></div>}
        <div className="form-grid">
          <label className="field"><span>الكود</span><input className="input" dir="ltr" required placeholder="SUMMER20" value={form.code} onChange={set('code')} /></label>
          <label className="field"><span>نوع الخصم</span>
            <select className="input" value={form.type} onChange={set('type')}>
              <option value="percent">نسبة مئوية</option>
              <option value="fixed">مبلغ ثابت</option>
            </select>
          </label>
          <label className="field"><span>{form.type === 'percent' ? 'النسبة %' : 'المبلغ'}</span><input className="input" type="number" min="0.01" step="0.01" max={form.type === 'percent' ? 100 : undefined} required value={form.value} onChange={set('value')} /></label>
          <label className="field"><span>الحد الأدنى للطلب</span><input className="input" type="number" min="0" step="0.01" placeholder="بدون حد" value={form.min_total} onChange={set('min_total')} /></label>
          <label className="field"><span>أقصى عدد استخدامات</span><input className="input" type="number" min="1" step="1" placeholder="بلا حد" value={form.max_uses} onChange={set('max_uses')} /></label>
          <label className="field"><span>تاريخ الانتهاء</span><input className="input" type="date" value={form.expires_at} onChange={set('expires_at')} /></label>
        </div>
        <div style={{ marginTop: 20 }}><button className="btn">إنشاء الكود</button></div>
      </form>
      <div className="panel">
        {!coupons.length ? (
          <p className="muted" style={{ textAlign: 'center', padding: '16px 0' }}>لا توجد أكواد خصم بعد.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>الكود</th><th>الخصم</th><th>الحد الأدنى</th><th>الاستخدام</th><th>ينتهي</th><th>الحالة</th><th><span className="visually-hidden">إجراءات</span></th></tr></thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td><strong dir="ltr">{c.code}</strong></td>
                    <td>{c.type === 'percent' ? `${c.value}%` : formatPrice(c.value)}</td>
                    <td>{c.min_total ? formatPrice(c.min_total) : '—'}</td>
                    <td>{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                    <td>{c.expires_at || '—'}</td>
                    <td>
                      <label className="check"><input type="checkbox" checked={!!c.active} onChange={() => toggle(c)} /> {c.active ? 'مفعّل' : 'معطّل'}</label>
                    </td>
                    <td><div className="actions"><button className="icon-btn danger" onClick={() => del(c)} aria-label={`حذف ${c.code}`}><Trash size={18} /></button></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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
    <div className="panel">
      <div className="table-wrap">
      <table className="table">
        <thead><tr><th>الاسم</th><th>البريد</th><th>الهاتف</th><th>الطلبات</th><th>إجمالي المشتريات</th><th>تاريخ التسجيل</th><th>الصلاحية</th></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td><span dir="ltr">{u.email}</span></td>
              <td><span dir="ltr">{u.phone || "—"}</span></td>
              <td>{u.orders_count}</td>
              <td>{formatPrice(u.total_spent)}</td>
              <td>{formatDate(u.created_at)}</td>
              <td>
                {u.id === me.id ? (
                  <span className="badge plain">مدير (أنت)</span>
                ) : u.role === 'admin' ? (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRole(u, 'customer')}>إزالة صلاحية المدير</button>
                ) : (
                  <button className="btn btn-ghost btn-sm" onClick={() => setRole(u, 'admin')}>ترقية لمدير</button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}

const TABS = { products: ['المنتجات', ProductsTab], orders: ['الطلبات', OrdersTab], coupons: ['أكواد الخصم', CouponsTab], users: ['المستخدمون', UsersTab] };

export default function Admin() {
  const [tab, setTab] = useState('products');
  const Tab = TABS[tab][1];
  return (
    <>
      <div className="page-head"><h1>لوحة التحكم</h1></div>
      <Stats />
      <div className="segmented admin-tabs" role="group" aria-label="الأقسام">
        {Object.entries(TABS).map(([k, [label]]) => (
          <button key={k} aria-pressed={tab === k} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <Tab />
    </>
  );
}
