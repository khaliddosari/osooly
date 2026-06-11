/* Navbar + mobile glass drawer. Exposes window.Navbar */
const { useState, useEffect } = React;

function Navbar({ activeId, onNav }) {
  const P = window.PORTFOLIO;
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const scroller = document.querySelector('.kit-scroll');
    if (!scroller) return;
    const onScroll = () => setScrolled(scroller.scrollTop > 50);
    scroller.addEventListener('scroll', onScroll);
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  const go = (id) => { setMenuOpen(false); onNav(id); };

  const social = (
    <React.Fragment>
      <a href={'mailto:' + P.identity.email} aria-label="Email"><i className="fas fa-envelope"></i></a>
      <a href={'tel:' + P.identity.phone.replace(/\s/g, '')} aria-label="Phone"><i className="fas fa-phone"></i></a>
      <a href={P.identity.linkedin} target="_blank" rel="noopener" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
      <a href={P.identity.github} target="_blank" rel="noopener" aria-label="GitHub"><i className="fab fa-github"></i></a>
    </React.Fragment>
  );

  return (
    <nav className={'navbar' + (scrolled ? ' scrolled' : '')}>
      <div className="nav-container">
        <a className="nav-logo" onClick={() => go('hero')} aria-label="Home">
          <img src="../../assets/logo-mark.svg" alt="Liquid Glass" className="logo-img" />
        </a>
        <button className={'nav-toggle' + (menuOpen ? ' active' : '')} onClick={() => setMenuOpen(o => !o)} aria-label="Toggle navigation">
          <span className="hamburger"></span>
        </button>
        <div className={'nav-overlay' + (menuOpen ? ' open' : '')} onClick={() => setMenuOpen(false)}></div>
        <ul className={'nav-links' + (menuOpen ? ' open' : '')}>
          <li className="sidebar-header">
            <div className="sidebar-brand">
              <img src="../../assets/logo-mark.svg" alt="" className="sidebar-logo" />
              <div>
                <span className="sidebar-name">{P.identity.nameEn}</span>
                <span className="sidebar-tagline">{P.identity.sidebarTagline}</span>
              </div>
            </div>
          </li>
          {P.nav.map(n => (
            <li key={n.id}>
              <a className={activeId === n.id ? 'active' : ''} onClick={() => go(n.id)} aria-label={n.label}>
                <i className={'fas ' + n.icon}></i><span className="nav-label">{n.label}</span>
              </a>
            </li>
          ))}
          <li className="sidebar-footer">
            <div className="sidebar-social">{social}</div>
          </li>
        </ul>
      </div>
    </nav>
  );
}
window.Navbar = Navbar;
