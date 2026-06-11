/** Liquid-glass strip with the two LinkedIn entries from PRD §3.4. */
export function Footer() {
  return (
    <footer className="relative z-10 flex w-full shrink-0 items-center justify-center gap-3 whitespace-nowrap border-t border-outline-variant bg-surface/70 px-4 py-5 text-center backdrop-blur-md md:px-10">
      <span className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
        Made by
      </span>
      <a
        href="https://www.linkedin.com/in/khalid-al-dosari"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-primary transition-colors hover:text-primary-container"
      >
        <i className="fab fa-linkedin text-[15px]" aria-hidden="true" />
        Khalid Al Dosari
      </a>
      <a
        href="https://www.linkedin.com/in/ahmed-alasmari-sa"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 text-sm font-bold text-primary transition-colors hover:text-primary-container"
      >
        <i className="fab fa-linkedin text-[15px]" aria-hidden="true" />
        Ahmad Alasmari
      </a>
    </footer>
  );
}
