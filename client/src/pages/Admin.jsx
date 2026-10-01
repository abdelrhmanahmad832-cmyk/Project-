import { useEffect, useState } from 'react';
import { api, formatPrice, STATUS_LABELS } from '../api.js';

const EMPTY = { name: '', description: '', price: '', stock: '', category: '', image_url: '' };

function Stats() {
  const [stats, setStats] = useState(null);
  useEffect(() => { api('/orders/stats').then(setStats).catch(() => {}); }, []);
  if (!stats) return null;
  return (
    <div className="stats">
      <div className="card stat"><span>الإيرادات</span><strong>{formatPrice(stats.revenue)}</strong></div>
      <div className="card stat"><span>الطلبات</span><strong>{stats.orders}</strong></div>
      <div className="card stat"><span>المنتجات</span><strong>{stats.products}</strong></div>
      <div className="card stat"><span>العملاء</span><strong>{stats.customers}</strong></div>
    </div>
  );
}

function ProductsTab() {
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState('');

  const load = () => api('/products').then(setProducts).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const reset = () => { setForm(EMPTY); setEditingId(null); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    const body = { ...form, price: Number(form.price), stock: Number(form.stock || 0) };
    try {
      if (editingId) await api(`/products/${editingId}`, { method: 'PUT', body });
      else await api('/products', { method: 'POST', body });
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
    try { await api(`/products/${p.id}`, { method: 'DELETE' }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      <form className="card pad form admin-form" onSubmit={submit}>
        <h3>{editingId ? `تعديل المنتج #${editingId}` : 'إضافة منتج جديد'}</h3>
        {error && <p className="alert">{error}</p>}
        <div className="form-grid">
          <label>الاسم<input className="input" required value={form.name} onChange={set('name')} /></label>
          <label>التصنيف<input className="input" value={form.category} onChange={set('category')} placeholder="عام" /></label>
          <label>السعر<input className="input" type="number" min="0" step="0.01" required value={form.price} onChange={set('price')} /></label>
          <label>المخزون<input className="input" type="number" min="0" step="1" value={form.stock} onChange={set('stock')} /></label>
          <label className="span-2">رابط الصورة<input className="input" type="url" dir="ltr" value={form.image_url} onChange={set('image_url')} /></label>
          <label className="span-2">الوصف<textarea className="input" value={form.description} onChange={set('description')} /></label>
        </div>
        <div className="row">
          <button className="btn">{editingId ? 'حفظ التعديلات' : 'إضافة'}</button>
          {editingId && <button type="button" className="btn btn-ghost" onClick={reset}>إلغاء</button>}
        </div>
      </form>

      <div className="card pad">
        <table className="table">
          <thead><tr><th>#</th><th>المنتج</th><th>التصنيف</th><th>السعر</th><th>المخزون</th><th></th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id}>
                <td>{p.id}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{formatPrice(p.price)}</td>
                <td className={p.stock === 0 ? 'danger-text' : ''}>{p.stock}</td>
                <td className="actions">
                  <button className="btn btn-ghost btn-sm" onClick={() => edit(p)}>تعديل</button>
                  <button className="btn btn-danger btn-sm" onClick={() => del(p)}>حذف</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function OrdersTab() {
  const [orders, setOrders] = useState([]);
  const [error, setError] = useState('');

  const load = () => api('/orders').then(setOrders).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const changeStatus = async (id, status) => {
    setError('');
    try { await api(`/orders/${id}/status`, { method: 'PATCH', body: { status } }); load(); } catch (err) { setError(err.message); }
  };

  return (
    <>
      {error && <p className="alert">{error}</p>}
      {!orders.length && <p className="muted">لا توجد طلبات بعد.</p>}
      {orders.map((o) => (
        <div key={o.id} className="card pad order">
          <div className="order-head">
            <strong>طلب #{o.id}</strong>
            <span>{o.customer_name} <span className="muted" dir="ltr">({o.customer_email})</span></span>
            <span className="muted">{new Date(o.created_at + 'Z').toLocaleString('ar-EG')}</span>
            <select className="input select" value={o.status} onChange={(e) => changeStatus(o.id, e.target.value)}>
              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <p className="muted">📍 {o.address} — 📞 <span dir="ltr">{o.phone}</span></p>
          <ul>
            {o.items.map((i) => <li key={i.id}>{i.product_name} × {i.quantity} — {formatPrice(i.unit_price * i.quantity)}</li>)}
          </ul>
          <strong>الإجمالي: {formatPrice(o.total)}</strong>
        </div>
      ))}
    </>
  );
}

export default function Admin() {
  const [tab, setTab] = useState('products');
  return (
    <>
      <h2>لوحة التحكم</h2>
      <Stats />
      <div className="tabs">
        <button className={`chip-btn ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>المنتجات</button>
        <button className={`chip-btn ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>الطلبات</button>
      </div>
      {tab === 'products' ? <ProductsTab /> : <OrdersTab />}
    </>
  );
}
