import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Handbag, House, Receipt, User, SquaresFour, SignOut, SignIn } from '@phosphor-icons/react';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useConfig } from '../context/ConfigContext.jsx';

export function Brand() {
  const { storeName } = useConfig();
  return (
    <Link to="/" className="brand" aria-label={`${storeName} — الرئيسية`}>
      <span className="brand-mark" aria-hidden="true"><Handbag size={18} weight="bold" /></span>
      {storeName}
    </Link>
  );
}

function CartCount() {
  const { count } = useCart();
  if (!count) return null;
  return <span className="cart-count" key={count}>{count > 99 ? '99+' : count}</span>;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const signOut = () => { navigate('/', { replace: true }); logout(); };

  return (
    <>
      <header className="navbar">
        <div className="container nav-inner">
          <Brand />
          <nav className="nav-links" aria-label="القائمة الرئيسية">
            <NavLink to="/" end>المنتجات</NavLink>
            {user && <NavLink to="/orders">طلباتي</NavLink>}
            {user?.role === 'admin' && <NavLink to="/admin">لوحة التحكم</NavLink>}
          </nav>
          <div className="nav-end">
            <div className="nav-user">
              {user ? (
                <>
                  <NavLink to="/profile" className="btn btn-quiet"><User size={18} /> {user.name}</NavLink>
                  <button className="icon-btn" onClick={signOut} aria-label="تسجيل الخروج" title="تسجيل الخروج"><SignOut size={20} /></button>
                </>
              ) : (
                <Link to="/login" className="btn btn-quiet">تسجيل الدخول</Link>
              )}
            </div>
            <Link to="/cart" className="icon-btn cart-btn" aria-label="السلة"><Handbag size={22} /><CartCount /></Link>
          </div>
        </div>
      </header>

      <nav className="tabbar" aria-label="التنقل">
        <NavLink to="/" end><House size={24} />الرئيسية</NavLink>
        <NavLink to="/cart"><Handbag size={24} />السلة<CartCount /></NavLink>
        {user && <NavLink to="/orders"><Receipt size={24} />طلباتي</NavLink>}
        {user?.role === 'admin' && <NavLink to="/admin"><SquaresFour size={24} />الإدارة</NavLink>}
        {user ? <NavLink to="/profile"><User size={24} />حسابي</NavLink> : <NavLink to="/login"><SignIn size={24} />دخول</NavLink>}
      </nav>
    </>
  );
}
