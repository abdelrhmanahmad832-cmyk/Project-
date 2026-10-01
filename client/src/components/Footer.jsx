import { Link } from 'react-router-dom';
import { Brand } from './Navbar.jsx';
import { useConfig } from '../context/ConfigContext.jsx';

export default function Footer() {
  const { storeName } = useConfig();
  return (
    <footer className="footer">
      <div className="container footer-inner">
        <Brand />
        <nav aria-label="روابط">
          <Link to="/">المنتجات</Link>
          <Link to="/orders">طلباتي</Link>
          <Link to="/profile">حسابي</Link>
        </nav>
        <span>© {new Date().getFullYear()} {storeName}</span>
      </div>
    </footer>
  );
}
