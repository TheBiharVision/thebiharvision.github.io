/* Builds the shared header/footer from config.js and wires up interactive nav + search. */
(function () {
  const cfg = window.SITE_CONFIG;
  if (!cfg) return;

  const ICONS = {
    youtube: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3.02 3.02 0 0 0-2.12-2.14C19.44 3.5 12 3.5 12 3.5s-7.44 0-9.38.56A3.02 3.02 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3.02 3.02 0 0 0 2.12 2.14c1.94.56 9.38.56 9.38.56s7.44 0 9.38-.56a3.02 3.02 0 0 0 2.12-2.14A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/>
    </svg>`,
    instagram: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5"/>
      <circle cx="12" cy="12" r="4.3"/>
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none"/>
    </svg>`,
    facebook: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.17 8.44 9.94v-7.03H7.9v-2.91h2.54V9.86c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.91h-2.34V22c4.78-.77 8.44-4.94 8.44-9.94Z"/>
    </svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,
    hamburger: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    close: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`
  };

  function buildHeader() {
    const el = document.getElementById('site-header');
    if (!el) return;
    const path = window.location.pathname;

    const navLinks = cfg.nav.map(item => {
      const current = (item.href === '/' && (path === '/' || path.endsWith('/index.html')))
        || (item.href !== '/' && path.startsWith(item.href.replace(/index\.html$/, '')));
      return `<li><a href="${item.href}" ${current ? 'aria-current="page"' : ''}>${item.label}</a></li>`;
    }).join('');

    el.innerHTML = `
      <a class="skip-link" href="#main-content">Skip to main content</a>
      <div class="header-inner">
        <a class="brand" href="/" aria-label="${cfg.siteName} home">
          <img src="${cfg.logo}" alt="${cfg.siteName} logo" width="36" height="36">
          <span>${cfg.siteName}</span>
        </a>

        <nav class="main-nav" aria-label="Primary">
          <ul style="display:flex;gap:1.75rem;">${navLinks}</ul>
        </nav>

        <div class="header-actions">
          <div class="desktop-actions">
            <button class="icon-btn" id="search-toggle" aria-expanded="false" aria-controls="search-panel" aria-label="Open search">
              ${ICONS.search}
            </button>
            <a class="btn btn-sm" href="${cfg.youtube.subscribeUrl}" target="_blank" rel="noopener">
              ${ICONS.youtube}
              <span>Subscribe</span>
            </a>
          </div>

          <button class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="nav-overlay" aria-label="Open menu">
            ${ICONS.hamburger}
          </button>
        </div>
      </div>

      <div class="search-panel" id="search-panel">
        <form action="/search/" method="get" role="search">
          <label class="visually-hidden" for="header-search">Search episodes</label>
          <input type="search" id="header-search" name="q" placeholder="Search episodes, topics, guests…" autocomplete="off">
          <button class="btn" type="submit">Search</button>
        </form>
      </div>

      <div class="nav-overlay" id="nav-overlay">
        <div class="header-inner" style="padding:0;">
          <a class="brand" href="/">
            <img src="${cfg.logo}" alt="${cfg.siteName} logo" width="36" height="36">
            <span>${cfg.siteName}</span>
          </a>
          <button class="icon-btn" id="menu-close" aria-label="Close menu">
            ${ICONS.close}
          </button>
        </div>

        <nav class="mobile-nav" aria-label="Mobile primary">
          <ul>${navLinks}</ul>
        </nav>

        <div class="mobile-search">
          <form action="/search/" method="get" role="search">
            <label class="visually-hidden" for="mobile-search-input">Search episodes</label>
            <input type="search" id="mobile-search-input" name="q" placeholder="Search episodes, topics, guests…" autocomplete="off">
            <button type="submit" aria-label="Search">${ICONS.search}</button>
          </form>
        </div>

        <a class="btn mobile-subscribe-btn" href="${cfg.youtube.subscribeUrl}" target="_blank" rel="noopener">
          ${ICONS.youtube}
          <span>Subscribe on YouTube</span>
        </a>
      </div>
    `;

    const searchToggle = document.getElementById('search-toggle');
    const searchPanel = document.getElementById('search-panel');
    searchToggle.addEventListener('click', () => {
      const open = searchPanel.classList.toggle('open');
      searchToggle.setAttribute('aria-expanded', open);
      if (open) document.getElementById('header-search').focus();
    });

    const menuToggle = document.getElementById('menu-toggle');
    const navOverlay = document.getElementById('nav-overlay');
    const menuClose = document.getElementById('menu-close');

    menuToggle.addEventListener('click', () => {
      navOverlay.classList.add('open');
      menuToggle.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      const firstLink = navOverlay.querySelector('.mobile-nav a');
      if (firstLink) firstLink.focus();
    });

    function closeMobileMenu() {
      navOverlay.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      menuToggle.focus();
    }

    menuClose.addEventListener('click', closeMobileMenu);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        closeMobileMenu();
        searchPanel.classList.remove('open');
      }
    });

    function onScroll() {
      if (window.scrollY > 8) {
        el.classList.add('scrolled');
      } else {
        el.classList.remove('scrolled');
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  function buildFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    const explore = cfg.footerLinks.explore.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
    const about = cfg.footerLinks.about.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
    const legal = cfg.footerLinks.legal.map(i => `<a href="${i.href}">${i.label}</a>`).join('');

    el.innerHTML = `
      <div class="footer-border-strip">
        <img src="/assets/img/bihar-vision-footer.png" alt="" role="presentation" loading="lazy">
      </div>
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand" style="color:#fff;margin-bottom:.75rem;">
              <img src="${cfg.logo}" alt="${cfg.siteName} logo" width="36" height="36">
              <span>${cfg.siteName}</span>
            </div>
            <p style="color:#D9C2B0;max-width:34ch;">${cfg.tagline} <a href="/about.html" style="color:var(--accent-ochre);font-weight:700;font-size:.85rem;white-space:nowrap;">Read more →</a></p>
            <div class="social-row">
              <a class="icon-btn social-icon" href="${cfg.youtube.channelUrl}" target="_blank" rel="noopener" aria-label="${cfg.siteName} on YouTube">${ICONS.youtube}</a>
              <a class="icon-btn social-icon" href="${cfg.social.instagram}" target="_blank" rel="noopener" aria-label="${cfg.siteName} on Instagram">${ICONS.instagram}</a>
              <a class="icon-btn social-icon" href="${cfg.social.facebook}" target="_blank" rel="noopener" aria-label="${cfg.siteName} on Facebook">${ICONS.facebook}</a>
            </div>
          </div>
          <div><h3>Explore</h3>${explore}</div>
          <div><h3>About</h3>${about}</div>
          <div><h3>Legal</h3>${legal}</div>
        </div>
        <!-- <div class="footer-bottom" style="display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:center;"> -->
        <div class="footer-bottom">
          <span>© ${year} ${cfg.siteName}. All rights reserved.</span>
          <span class="footer-faq-sitemap"><a href="/faq.html" style="color:#D9C2B0;">FAQs</a> &middot; <a href="${cfg.footerLinks.sitemap.html}" style="color:#D9C2B0;">Sitemap</a></span>
          <br class="footer-break">
          <span>Designed by <a href="${cfg.designCredit.url}" target="_blank" rel="noopener" style="color:#fff;text-decoration:none;">${cfg.designCredit.name}</a></span>
        </div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildHeader();
    buildFooter();
  });
})();
