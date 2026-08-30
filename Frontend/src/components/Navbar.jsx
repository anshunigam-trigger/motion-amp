import Logo from './Logo';

export default function Navbar({ dark, children, onNavigate }) {
  return (
    <nav className={`navbar ${dark ? 'navbar--dark' : ''}`}>
      <div className="nav-inner">
        <Logo onClick={() => onNavigate('landing')} />
        {children}
      </div>
    </nav>
  );
}
