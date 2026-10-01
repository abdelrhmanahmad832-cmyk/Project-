import { Link } from 'react-router-dom';
import { formatPrice } from '../api.js';
import { useCart } from '../context/CartContext.jsx';

export default function Cart() {
  const { items, update, remove, total } = useCart();

  if (!items.length) {
    return (
      <div className="center">
        <h2>سلتك فارغة</h2>
        <Link to="/" className="btn">تصفح المنتجات</Link>
      </div>
    );
  }

  return (
    <div className="card pad">
      <h2>سلة المشتريات</h2>
      <table className="table">
        <thead>
          <tr><th>المنتج</th><th>السعر</th><th>الكمية</th><th>الإجمالي</th><th></th></tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.id}>
              <td className="cell-product">
                <img src={i.image_url || 'https://placehold.co/80'} alt="" />
                <Link to={`/products/${i.id}`}>{i.name}</Link>
              </td>
              <td>{formatPrice(i.price)}</td>
              <td>
                <input
                  type="number" className="input qty" min="1" max={i.stock} value={i.quantity}
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
        <strong>الإجمالي: {formatPrice(total)}</strong>
        <Link to="/checkout" className="btn">إتمام الطلب</Link>
      </div>
    </div>
  );
}
