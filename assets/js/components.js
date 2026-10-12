/* Builds the shared header/footer from config.js and wires up interactive nav + search. */
(function () {
  const cfg = window.SITE_CONFIG;
  if (!cfg) return;

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
          <button class="icon-btn" id="search-toggle" aria-expanded="false" aria-controls="search-panel" aria-label="Open search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          <a class="btn btn-sm" href="${cfg.youtube.subscribeUrl}" target="_blank" rel="noopener">Subscribe</a>
          <button class="icon-btn menu-toggle" id="menu-toggle" aria-expanded="false" aria-controls="nav-overlay" aria-label="Open menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
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
          <a class="brand" href="/"><img src="${cfg.logo}" alt="${cfg.siteName} logo" width="36" height="36"><span>${cfg.siteName}</span></a>
          <button class="icon-btn" id="menu-close" aria-label="Close menu">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <nav class="main-nav" aria-label="Mobile primary"><ul>${navLinks}</ul></nav>
        <a class="btn" style="margin-top:1.5rem;width:fit-content;" href="${cfg.youtube.subscribeUrl}" target="_blank" rel="noopener">Subscribe on YouTube</a>
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
      navOverlay.querySelector('a').focus();
    });
    menuClose.addEventListener('click', () => {
      navOverlay.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.focus();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        navOverlay.classList.remove('open');
        searchPanel.classList.remove('open');
      }
    });
  }

  function buildFooter() {
    const el = document.getElementById('site-footer');
    if (!el) return;
    const year = new Date().getFullYear();
    const explore = cfg.footerLinks.explore.map(i => `<a href="${i.href}">${i.label}</a>`).join('');
    const legal = cfg.footerLinks.legal.map(i => `<a href="${i.href}">${i.label}</a>`).join('');

    el.innerHTML = `
      <div class="container">
        <div class="footer-grid">
          <div>
            <div class="brand" style="color:#fff;margin-bottom:.75rem;">
              <img src="${cfg.logo}" alt="${cfg.siteName} logo" width="36" height="36">
              <span>${cfg.siteName}</span>
            </div>
            <p style="color:#B5B5B5;max-width:32ch;">${cfg.tagline}</p>
            <div class="social-row">
              <a class="icon-btn" style="border-color:#333;" href="${cfg.youtube.channelUrl}" target="_blank" rel="noopener" aria-label="YouTube channel">YT</a>
              <a class="icon-btn" style="border-color:#333;" href="${cfg.social.instagram}" target="_blank" rel="noopener" aria-label="Instagram">IG</a>
              <a class="icon-btn" style="border-color:#333;" href="${cfg.social.facebook}" target="_blank" rel="noopener" aria-label="Facebook">FB</a>
            </div>
          </div>
          <div><h3>Explore</h3>${explore}</div>
          <div><h3>Legal</h3>${legal}</div>
          <div>
            <h3>Resources</h3>
            <a href="${cfg.footerLinks.sitemap.html}">HTML Sitemap</a>
            <a href="${cfg.footerLinks.sitemap.xml}">XML Sitemap</a>
            <a href="mailto:${cfg.email}">${cfg.email}</a>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© ${year} ${cfg.siteName}. All rights reserved.</span>
          <span>Designed by <a href="${cfg.designCredit.url}" target="_blank" rel="noopener" style="color:#fff;text-decoration:underline;">${cfg.designCredit.name}</a></span>
        </div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', () => {
    buildHeader();
    buildFooter();
  });
})();
