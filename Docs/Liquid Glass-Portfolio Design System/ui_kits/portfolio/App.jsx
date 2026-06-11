/* App — assembles the single-page portfolio with scroll-spy + smooth nav.
   The whole page scrolls inside .kit-scroll so the navbar scroll state works
   inside the kit preview frame. */
const { useRef } = React;

function App() {
  const { About, Education, Languages } = window.Sections;
  const { Projects, Experience, Certifications, Skills, Footer } = window.Cards;
  const [activeId, setActiveId] = useState('hero');
  const scrollRef = useRef(null);

  const ids = ['hero', ...window.PORTFOLIO.nav.map(n => n.id)];

  const handleNav = (id) => {
    const scroller = scrollRef.current;
    const el = scroller && scroller.querySelector('#' + id);
    if (el && scroller) {
      const top = el.offsetTop - (id === 'hero' ? 0 : 70);
      scroller.scrollTo({ top, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const onScroll = () => {
      let current = 'hero';
      for (const id of ids) {
        const el = scroller.querySelector('#' + id);
        if (el && scroller.scrollTop >= el.offsetTop - 120) current = id;
      }
      setActiveId(current);
    };
    scroller.addEventListener('scroll', onScroll);
    onScroll();
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="kit-mobile kit-scroll" ref={scrollRef}>
      <Navbar activeId={activeId} onNav={handleNav} />
      <Hero onNav={handleNav} />
      <About />
      <Education />
      <Projects />
      <Experience />
      <Certifications />
      <Skills />
      <Languages />
      <Footer />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
