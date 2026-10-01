import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Handbag, Trash, Truck } from '@phosphor-icons/react';
import { api, formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';
import Stepper from '../components/Stepper.jsx';
import Empty from '../components/Empty.jsx';

export function ShippingProgress({ subtotal }) {
  const { freeShippingMin } = useConfig();
  if (!freeShippingMin) return null;
  const remaining = freeShippingMin - subtotal;
  const ratio = Math.min(subtotal / freeShippingMin, 1);
  return (
    <div className="ship-progress">
      <p><Truck size={18} />{remaining > 0 ? <>أضف <strong className="num">{formatPrice(remaining)}</strong> لتحصل على شحن مجاني</> : 'طلبك مؤهل للشحن المجاني'}</p>
      <div className="ship-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <span style={{ transform: `scaleX(${ratio})` }} />
      </div>
    </div>
  );
}

export default function Cart() {
  const { items, update, remove, total, count, sync } = useCart();
  const ids = items.map((i) => i.id).join(',');

  // Make sure prices and stock are current before the customer checks out.
  useEffect(() => {
    if (!ids) return;
    api(`/products?ids=${ids}&limit=100`).then((d) => sync(d.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items.length) {
    return (
      <Empty icon={Handbag} title="سلتك فارغة" action={<Link to="/" className="btn">تصفّح المنتجات</Link>}>
        أضف المنتجات التي تعجبك وستجدها هنا.
      </Empty>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>السلة</h1>
          <p className="num">{count} قطعة</p>
        </div>
      </div>
      <div className="split">
        <ul className="line-items panel">
          {items.map((i) => (
            <li key={i.id} className="line-item">
              <Link to={`/products/${i.id}`} tabIndex={-1} aria-hidden="true"><img src={i.image_url || PLACEHOLDER_IMG} alt="" /></Link>
              <div className="line-item-body">
                <Link to={`/products/${i.id}`}>{i.name}</Link>
                <span className="muted small num">{formatPrice(i.price)} للقطعة</span>
                <div className="line-item-controls">
                  <Stepper size="sm" value={i.quantity} max={i.stock} onChange={(n) => update(i.id, n)} label={`كمية ${i.name}`} />
                  <button className="icon-btn danger" onClick={() => remove(i.id)} aria-label={`احذف ${i.name}`}><Trash size={18} /></button>
                </div>
              </div>
              <span className="line-item-total">{formatPrice(i.price * i.quantity)}</span>
            </li>
          ))}
        </ul>
        <aside className="panel aside-sticky">
          <ShippingProgress subtotal={total} />
          <div className="summary-line total"><span>المجموع الفرعي</span><span>{formatPrice(total)}</span></div>
          <p className="muted small" style={{ marginBottom: 16 }}>الشحن والخصومات تُحسب في الخطوة التالية.</p>
          <Link to="/checkout" className="btn btn-accent btn-lg btn-block">إتمام الطلب</Link>
        </aside>
      </div>
    </>
  );
}
