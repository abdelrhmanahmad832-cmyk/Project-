import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api, formatPrice, PLACEHOLDER_IMG } from '../api.js';
import { useCart } from '../context/CartContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';

export default function Cart() {
  const { items, update, remove, total, sync } = useCart();
  const { freeShippingMin } = useConfig();
  const ids = items.map((i) => i.id).join(',');

  // Make sure prices and stock are current before the customer checks out.
  useEffect(() => {
    if (!ids) return;
    api(`/products?ids=${ids}&limit=100`).then((d) => sync(d.items)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!items.length) {
    return (
      <div className="center">
        <h2>سلتك فارغة</h2>
        <Link to="/" className="btn">تصفح المنتجات</Link>
      </div>
    );
  }

  const remaining = freeShippingMin - total;

  return (
    <div className="card pad">
      <h2>سلة المشتريات</h2>
      {freeShippingMin > 0 && (
        <p className={remaining > 0 ? 'info' : 'success'}>
          {remaining > 0 ? `أضف منتجات بقيمة ${formatPrice(remaining)} للحصول على شحن مجاني 🚚` : 'طلبك مؤهل للشحن المجاني 🎉'}
        </p>
      )}
      <table className="table">
        <thead>
          <tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="cell-product">
                <img src={i.image_url || PLACEHOLDER_IMG} alt="" />
                <Link to={`/products/${i.id}`}>{i.name}</Link>
              </td>
              <td>{formatPrice(i.price)}</td>
              <td>
                <input
                  type="number" className="input qty" min="1" max={i.stock} value={i.quantity} aria-label="الكمية"
                  onChange={(e) => update(i.id, Math.max(1, Math.min(i.stock, Number(e.target.value) || 1)))}
                />
              </td>
              <td>{formatPrice(i.price * i.quantity)}</td>
              <td><button className="btn btn-danger btn-sm" onClick={() => remove(i.id)}>حذف</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="cart-summary">
        <strong>المجموع الفرعي: {formatPrice(total)}</strong>
        <Link to="/checkout" className="btn">إتمام الطلب</Link>
      </div>
    </div>
  );
}
