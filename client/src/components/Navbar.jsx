import { useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { count } = useCart();
  const { storeName } = useConfig();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header className="navbar">
      <div className="container nav-inner">
        <Link to="/" className="logo">🛍️ {storeName}</Link>
        <div className="nav-actions">
          <NavLink to="/cart" className="cart-link" aria-label="السلة">
            🛒 {count > 0 && <span className="badge">{count}</span>}
          </NavLink>
          <button className="menu-btn" aria-label="القائمة" aria-expanded={open} onClick={() => setOpen(!open)}>☰</button>
        </div>
        <nav className={`nav-links ${open ? 'open' : ''}`}>
          <NavLink to="/" end>المنتجات</NavLink>
          {user && <NavLink to="/orders">طلباتي</NavLink>}
          {user && <NavLink to="/profile">حسابي</NavLink>}
          {user?.role === 'admin' && <NavLink to="/admin">لوحة التحكم</NavLink>}
          {user ? (
            <button className="btn btn-ghost btn-sm" onClick={() => { navigate('/', { replace: true }); logout(); }}>
              خروج
            </button>
          ) : (
            <NavLink to="/login">دخول</NavLink>
          )}
        </nav>
      </div>
    </header>
  );
}
