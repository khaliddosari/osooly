/* Card sections: Projects, Experience timeline, Certifications, Skills, Footer.
   Exposes window.Cards */

function Projects() {
  const items = window.PORTFOLIO.projects;
  return (
    <section className="section" id="projects">
      <div className="container">
        <h2 className="section-title">Projects</h2>
        <div className="projects-grid">
          {items.map((p, i) => (
            <div className="project-card" key={i}>
              <h3>{p.title}</h3>
              <p>{p.desc}</p>
              <div className="project-tags">
                {p.tags.map(t => <span className="tag" key={t}>{t}</span>)}
              </div>
              <div className="project-links">
                <a href={p.code} target="_blank" rel="noopener"><i className="fab fa-github"></i> Code</a>
                {p.demo ? <a href={p.demo} target="_blank" rel="noopener"><i className="fas fa-external-link-alt"></i> Demo</a> : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Experience() {
  const items = window.PORTFOLIO.experience;
  return (
    <section className="section section-alt" id="experience">
      <div className="container">
        <h2 className="section-title">Experience</h2>
        <div className="timeline">
          {items.map((x, i) => (
            <div className="timeline-item" key={i}>
              <div className="timeline-dot"></div>
              <div className="timeline-content">
                <div className="exp-header">
                  <img src={x.logo} alt="Company Logo" className="org-logo" onError={(ev) => ev.target.style.display = 'none'} />
                  <div>
                    <h3>{x.role}</h3>
                    <p className="exp-company">{x.org}</p>
                  </div>
                </div>
                <p className="exp-dates"><i className="fas fa-calendar-alt"></i> {x.dates}</p>
                <ul className="exp-responsibilities">
                  {x.points.map((pt, j) => <li key={j}>{pt}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Certifications() {
  const items = window.PORTFOLIO.certifications;
  return (
    <section className="section" id="certifications">
      <div className="container">
        <h2 className="section-title">Certifications</h2>
        <div className="certs-grid">
          {items.map((c, i) => (
            <div className="cert-card" key={i}>
              <div className="cert-badge">
                <img src={c.logo} alt="Certification Badge" onError={(ev) => ev.target.style.visibility = 'hidden'} />
              </div>
              <div className="cert-info">
                <h3>{c.title}</h3>
                <p className="cert-org">{c.org}</p>
                <p className="cert-date"><i className="fas fa-calendar-alt"></i> {c.date}</p>
                <div className="cert-links">
                  <a href={c.link} target="_blank" rel="noopener" className="btn btn-sm"><i className={'fas ' + c.icon}></i> {c.linkLabel}</a>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Skills() {
  const groups = window.PORTFOLIO.skills;
  return (
    <section className="section section-alt" id="skills">
      <div className="container">
        <h2 className="section-title">Skills</h2>
        <div className="skills-container">
          {groups.map((g, i) => (
            <div className="skill-group" key={i}>
              <h3>{g.group}</h3>
              <div className="skill-tags">
                {g.tags.map(t => <span className="skill-tag" key={t}>{t}</span>)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const P = window.PORTFOLIO;
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-social">
          <a href={P.identity.linkedin} target="_blank" rel="noopener" aria-label="CV / Resume">
            <img src="../../assets/icon-cv.svg" alt="CV" style={{ width: '1em', height: '1em', verticalAlign: '-0.125em', filter: 'invert(64%) sepia(13%) saturate(420%) hue-rotate(196deg)' }} />
          </a>
          <a href={'mailto:' + P.identity.email} aria-label="Email"><i className="fas fa-envelope"></i></a>
          <a href={'tel:' + P.identity.phone.replace(/\s/g, '')} aria-label="Phone"><i className="fas fa-phone"></i></a>
          <a href={P.identity.linkedin} target="_blank" rel="noopener" aria-label="LinkedIn"><i className="fab fa-linkedin"></i></a>
          <a href={P.identity.github} target="_blank" rel="noopener" aria-label="GitHub"><i className="fab fa-github"></i></a>
        </div>
        <p className="footer-copy">© 2026 Khalid Al Dosari. All rights reserved.</p>
      </div>
    </footer>
  );
}

window.Cards = { Projects, Experience, Certifications, Skills, Footer };
