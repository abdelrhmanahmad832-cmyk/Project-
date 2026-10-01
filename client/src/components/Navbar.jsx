import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const navigate = useNavigate();

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">🛍️ سوق</Link>
        <nav className="nav-links">
          <NavLink to="/" end>المنتجات</NavLink>
          {user && <NavLink to="/orders">طلباتي</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">لوحة التحكم</NavLink>}
          <NavLink to="/cart" className="cart-link">
            السلة {count > 0 && <span className="badge">{count}</span>}
          </NavLink>
          {user ? (
            <button className="btn btn-ghost" onClick={() => { logout(); navigate('/'); }}>
              خروج ({user.name})
            </button>
          ) : (
            <NavLink to="/login">دخول</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
