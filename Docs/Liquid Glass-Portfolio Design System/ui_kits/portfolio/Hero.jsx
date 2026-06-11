/* Hero + simple sections (About, Education, Languages). Exposes window.Hero, window.Sections */

function ContactRow() {
  const P = window.PORTFOLIO;
  return (
    <div className="hero-contact">
      <a href={P.identity.linkedin} target="_blank" rel="noopener" aria-label="CV / Resume">
        <img src="../../assets/icon-cv.svg" alt="CV" style={{ width: '1em', height: '1em', verticalAlign: '-0.125em', filter: 'invert(64%) sepia(13%) saturate(420%) hue-rotate(196deg)' }} />
      </a>
      <a href={'mailto:' + P.identity.email} aria-label="Email"><i className="fas fa-envelope"></i></a>
      <a href={'tel:' + P.identity.phone.replace(/\s/g, '')} aria-label="Phone"><i className="fas fa-phone"></i></a>
      <a href={P.identity.linkedin} target="_blank" rel="noopener" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
      <a href={P.identity.github} target="_blank" rel="noopener" aria-label="GitHub"><i className="fab fa-github"></i></a>
    </div>
  );
}

function Hero({ onNav }) {
  const P = window.PORTFOLIO;
  return (
    <section className="hero" id="hero">
      <div className="hero-content">
        <div className="hero-photo">
          <img src="../../assets/photo.jpg" alt="Khalid's photo" />
        </div>
        <h1 className="hero-name hero-name-ar">{P.identity.nameAr}</h1>
        <h1 className="hero-name">{P.identity.nameEn}</h1>
        <p className="hero-tagline">{P.identity.tagline}</p>
        <ContactRow />
        <a className="btn btn-primary" onClick={() => onNav('projects')}>View My Work</a>
      </div>
    </section>
  );
}

function About() {
  const P = window.PORTFOLIO;
  return (
    <section className="section" id="about">
      <div className="container">
        <h2 className="section-title">About Me</h2>
        <div className="about-content">
          {P.about.map((p, i) => (
            <React.Fragment key={i}>
              <p>{p}</p>{i < P.about.length - 1 ? <br /> : null}
            </React.Fragment>
          ))}
        </div>
      </div>
    </section>
  );
}

function Education() {
  const e = window.PORTFOLIO.education;
  return (
    <section className="section section-alt" id="education">
      <div className="container">
        <h2 className="section-title">Education</h2>
        <div className="education-grid">
          <div className="edu-card">
            <div className="edu-card-header">
              <img src={e.logo} alt="University Logo" className="org-logo" onError={(ev) => ev.target.style.display = 'none'} />
              <div>
                <h3>{e.school}</h3>
                <p className="edu-degree">{e.degree}</p>
              </div>
            </div>
            <p className="edu-dates"><i className="fas fa-calendar-alt"></i> {e.dates}</p>
            <p className="edu-details">Volunteering:</p>
            <ul className="exp-responsibilities">
              {e.volunteering.map((v, i) => <li key={i}>{v}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Languages() {
  const langs = window.PORTFOLIO.languages;
  return (
    <section className="section" id="languages">
      <div className="container">
        <h2 className="section-title">Languages</h2>
        <div className="languages-grid">
          {langs.map(l => (
            <div className="language-card" key={l}><span className="language-name">{l}</span></div>
          ))}
        </div>
      </div>
    </section>
  );
}

window.Hero = Hero;
window.ContactRow = ContactRow;
window.Sections = { About, Education, Languages };
