/**
 * generate-pages.js
 *
 * Builds static, indexable HTML pages from the data files:
 *   - episodes/<slug>.html   one page per episode (data/episodes.json)
 *   - guests/<slug>.html     one page per VERIFIED guest (data/guests.json)
 *   - guests/index.html      guest directory
 *   - sitemap.xml            all pages above plus static pages
 *
 * Inputs:
 *   data/episodes.json          required, written by scripts/fetch-youtube.js
 *   data/episodes-manual.json   optional, guest lists keyed by YouTube video ID
 *   data/guests.json            optional, guest profiles
 *
 * A guest page is created only when the guest entry has verified: true,
 * consentConfirmed: true and a valid slug. Other guest names are shown as plain text.
 *
 * Run: node scripts/generate-pages.js
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://thebiharvision.github.io';
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const EPISODES_DIR = path.join(ROOT, 'episodes');
const GUESTS_DIR = path.join(ROOT, 'guests');
const SLUG_RE = /^[a-z0-9-]+$/;

// ---------- helpers ----------

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeName(name) {
  return String(name ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function absUrl(p) {
  if (!p) return '';
  if (/^https?:\/\//.test(p)) return p;
  return `${SITE_URL}${p.startsWith('/') ? '' : '/'}${p}`;
}

function hostLabel(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch (e) {
    return url;
  }
}

function readJson(file, fallback, required = false) {
  if (!fs.existsSync(file)) {
    if (required) throw new Error(`Required file missing: ${file}`);
    console.warn(`[generate-pages] NOTE: ${path.basename(file)} not found. Using empty values.`);
    return fallback;
  }
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    if (required) throw err;
    console.warn(`[generate-pages] WARNING: ${path.basename(file)} could not be parsed (${err.message}). Using empty values.`);
    return fallback;
  }
}

function ensureValidSlug(ep) {
  const isValid = typeof ep.slug === 'string' && SLUG_RE.test(ep.slug);
  if (isValid) return ep.slug;

  const fallback = `episode-${String(ep.id || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  console.warn(`[generate-pages] WARNING: Episode "${ep.title}" (id: ${ep.id}) has a missing/invalid slug ("${ep.slug}"). Using fallback slug: "${fallback}". Fix this in data/episodes.json or re-run scripts/fetch-youtube.js.`);
  return fallback;
}

function guestNamesOf(ep) {
  return Array.isArray(ep.guests) ? ep.guests.map(n => String(n)) : [];
}

function hostProfileLink(hostName) {
  const knownHosts = {
    'Alok Prasad': '/team/alok-prasad.html',
    'Ritesh Sharma': '/team/ritesh-sharma.html'
  };
  const url = knownHosts[hostName];
  return url ? `<a href="${url}">${esc(hostName)}</a>` : esc(hostName);
}

// ---------- social icons (inline SVG, no external files) ----------

function socialIcon(url) {
  const host = hostLabel(url).toLowerCase();

  if (host.includes('facebook.com') || host === 'fb.com') {
    return {
      label: 'Facebook',
      svg: '<path d="M14 8h2.5V4.5H14c-2.5 0-4 1.7-4 4.2V11H7.5v3.5H10V21h3.5v-6.5H16l.5-3.5h-3V8.7c0-.4.2-.7.9-.7z" fill="currentColor"/>'
    };
  }
  if (host.includes('instagram.com')) {
    return {
      label: 'Instagram',
      svg: '<rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/>'
    };
  }
  if (host.includes('youtube.com') || host === 'youtu.be') {
    return {
      label: 'YouTube',
      svg: '<rect x="2" y="5" width="20" height="14" rx="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'
    };
  }
  if (host.includes('spotify.com')) {
    return {
      label: 'Spotify',
      svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7.5 9.5c3-1 6.5-.7 9 .8M8 12.5c2.5-.8 5.3-.5 7.3.7M8.5 15.3c2-.6 4-.4 5.6.5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/>'
    };
  }
  return {
    label: host || 'Website',
    svg: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18" fill="none" stroke="currentColor" stroke-width="1.5"/>'
  };
}

function socialIconsHtml(links) {
  if (!links.length) return '';
  const items = links.map(u => {
    const icon = socialIcon(u);
    return `<a href="${esc(u)}" target="_blank" rel="noopener" aria-label="${esc(icon.label)}" title="${esc(icon.label)}" style="display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:1px solid #D9C7A3;border-radius:50%;color:#2E4057;background:#FFFFFF;text-decoration:none;"><svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icon.svg}</svg></a>`;
  }).join('');
  return `<h2>Connect on</h2><div class="social-icons" style="display:flex;flex-wrap:wrap;gap:.75rem;margin:.5rem 0 1rem;">${items}</div>`;
}

// ---------- data ----------

function applyManualOverrides(episodes, manual) {
  episodes.forEach(ep => {
    const override = manual[ep.youtubeVideoId] || manual[ep.id];
    if (override && Array.isArray(override.guests)) {
      ep.guests = override.guests;
    }
    ep.guests = guestNamesOf(ep);
  });
}

function buildGuestRegistry(guestsData) {
  const list = Array.isArray(guestsData.guests) ? guestsData.guests : [];
  const registry = new Map();
  const usedSlugs = new Set();

  list.forEach((g, i) => {
    if (!g || g.verified !== true || g.consentConfirmed !== true) return;

    const label = g.name || `entry #${i + 1}`;
    if (!g.name || typeof g.slug !== 'string' || !SLUG_RE.test(g.slug)) {
      console.warn(`[generate-pages] WARNING: Guest "${label}" skipped. Name is missing or slug is invalid (use only lowercase letters, numbers and hyphens).`);
      return;
    }
    if (usedSlugs.has(g.slug)) {
      console.warn(`[generate-pages] WARNING: Guest "${label}" skipped. Slug "${g.slug}" is already used by another guest.`);
      return;
    }
    usedSlugs.add(g.slug);
    registry.set(normalizeName(g.name), { ...g, name: String(g.name).trim() });
  });

  return registry;
}

function episodesWithGuest(items, guestName) {
  const key = normalizeName(guestName);
  return items
    .filter(({ ep }) => guestNamesOf(ep).some(n => normalizeName(n) === key))
    .sort((a, b) => String(b.ep.publishedAt || '').localeCompare(String(a.ep.publishedAt || '')));
}

function guestsLineHtml(names, verifiedGuests) {
  return names.map(name => {
    const g = verifiedGuests.get(normalizeName(name));
    const label = esc(name.trim());
    return g ? `<a href="/guests/${g.slug}.html">${label}</a>` : label;
  }).join(', ');
}

// ---------- shared page parts ----------

function pageHead({ title, description, canonical, ogType, image, jsonLd }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${canonical}">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<meta property="og:type" content="${ogType}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
${image ? `<meta property="og:image" content="${esc(absUrl(image))}">` : ''}
<meta property="og:url" content="${canonical}">
<meta property="og:site_name" content="The Bihar Vision">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/the-bihar-vision-logo.png" />
<link rel="apple-touch-icon" sizes="180x180" href="/assets/img/the-bihar-vision-logo.png" />
<meta name="theme-color" content="#2C1810" media="(prefers-color-scheme: dark)">
<meta name="theme-color" content="#F2E6D0" media="(prefers-color-scheme: light)">
<link rel="stylesheet" href="/assets/css/style.css">
<script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
</script>
</head>
<body>
<header id="site-header"></header>
<main id="main-content">`;
}

function pageFoot() {
  return `</main>
<footer id="site-footer"></footer>
<script src="/assets/js/config.js"></script>
<script src="/assets/js/components.js"></script>
<script src="/assets/js/main.js"></script>
</body>
</html>`;
}

// ---------- episode page ----------

function episodePageTemplate(ep, slug, verifiedGuests) {
  const title = ep.seoTitle || ep.title || 'Episode';
  const description = ep.seoDescription || ep.description || '';
  const canonical = `${SITE_URL}/episodes/${slug}.html`;
  const names = guestNamesOf(ep);

  const topics = Array.isArray(ep.topics) && ep.topics.length
    ? ep.topics.map(t => esc(t)).join(' · ')
    : 'Episode';

  const chaptersHtml = Array.isArray(ep.chapters) && ep.chapters.length
    ? `<ul>${ep.chapters.map(c => `<li>${esc(c.time)} — ${esc(c.label)}</li>`).join('')}</ul>`
    : `<p class="text-secondary">Chapter timestamps are not yet available for this episode. <span class="badge-dark">Unconfirmed</span></p>`;

  // Transcript is kept as HTML on purpose (same as before)
  const transcriptHtml = ep.transcript
    ? `<div>${ep.transcript}</div>`
    : `<p class="text-secondary">A transcript is not currently available for this episode.</p>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "VideoObject",
    name: ep.title,
    description: ep.description,
    thumbnailUrl: ep.thumbnailUrl ? [ep.thumbnailUrl] : undefined,
    uploadDate: ep.publishedAt,
    duration: ep.duration,
    embedUrl: `https://www.youtube-nocookie.com/embed/${ep.youtubeVideoId}`,
    contentUrl: ep.youtubeUrl,
    publisher: { "@type": "Organization", name: "The Bihar Vision" }
  };

  return pageHead({
    title,
    description,
    canonical,
    ogType: 'video.other',
    image: ep.thumbnailUrl,
    jsonLd
  }) + `
  <nav class="breadcrumb container" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/episodes/">Episodes</a> / <span aria-current="page">${esc(ep.title)}</span></nav>
  <article class="container" style="max-width:860px;">
    <p class="eyebrow">${topics}</p>
    <h1>${esc(ep.title)}</h1>
    <p class="text-secondary">Published ${esc(ep.publishedAt)}${ep.durationDisplay ? ' · ' + esc(ep.durationDisplay) : ''} · Hosted by ${hostProfileLink(ep.host)}</p>
    <div class="video-frame" style="margin:1.5rem 0;">
      <iframe src="https://www.youtube-nocookie.com/embed/${esc(ep.youtubeVideoId)}" title="${esc(ep.title)} | The Bihar Vision" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
    <a class="btn btn-outline" href="${esc(ep.youtubeUrl)}" target="_blank" rel="noopener">Watch on YouTube</a>
    <h2>Episode Summary</h2><p>${esc(ep.description)}</p>
    <h2>Host &amp; Guests</h2><p><strong>Host:</strong> ${hostProfileLink(ep.host)}${names.length ? `<br><strong>Guests:</strong> ${guestsLineHtml(names, verifiedGuests)}` : ''}</p>
    <h2>Chapters</h2>${chaptersHtml}
    <h2>Transcript</h2>${transcriptHtml}
  </article>
` + pageFoot();
}

// ---------- guest pages ----------

function episodeCardsHtml(items) {
  if (!items.length) {
    return `<p class="text-secondary">No episodes are linked to this guest yet.</p>`;
  }
  return `<div class="grid">${items.map(({ ep, slug }) => `
    <a class="card" href="/episodes/${slug}.html">
      ${ep.thumbnailUrl ? `<img src="${esc(ep.thumbnailUrl)}" alt="" loading="lazy" width="320" height="180" style="width:100%;height:auto;">` : ''}
      <h3>${esc(ep.title)}</h3>
      <p class="text-secondary">${esc(String(ep.publishedAt || '').slice(0, 10))}</p>
    </a>`).join('')}</div>`;
}

function guestPageTemplate(g, eps) {
  const canonical = `${SITE_URL}/guests/${g.slug}.html`;
  const title = `${g.name} — Guest | The Bihar Vision`;
  const description = g.summary || `${g.name} is a guest on The Bihar Vision.`;
  const links = Array.isArray(g.sameAs) ? g.sameAs.filter(u => typeof u === 'string' && u) : [];

  const photoHtml = g.photo
    ? `<img class="guest-photo" src="${esc(g.photo)}" alt="${esc(g.name)}" width="200" height="200" style="width:200px;height:200px;object-fit:cover;border-radius:12px;margin:0 0 1rem;">`
    : '';

  const linksHtml = socialIconsHtml(links);

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Person",
        "@id": `${canonical}#person`,
        name: g.name,
        jobTitle: g.role || undefined,
        description,
        image: g.photo ? absUrl(g.photo) : undefined,
        url: canonical,
        sameAs: links.length ? links : undefined
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guests", item: `${SITE_URL}/guests/` },
          { "@type": "ListItem", position: 3, name: g.name, item: canonical }
        ]
      }
    ]
  };

  return pageHead({
    title,
    description,
    canonical,
    ogType: 'profile',
    image: g.photo || null,
    jsonLd
  }) + `
  <nav class="breadcrumb container" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/guests/">Guests</a> / <span aria-current="page">${esc(g.name)}</span></nav>
  <article class="container" style="max-width:860px;">
    <p class="eyebrow">${esc(g.role || 'Guest')}</p>
    <h1>${esc(g.name)}</h1>
    ${photoHtml}
    <p>${esc(description)}</p>
    ${linksHtml}
    <h2>Episodes with ${esc(g.name)}</h2>
    ${episodeCardsHtml(eps)}
    <p style="margin-top:2rem;"><a class="btn btn-outline" href="/guests/">← All guests</a></p>
  </article>
` + pageFoot();
}

function guestsIndexTemplate(guestRows) {
  const url = `${SITE_URL}/guests/`;
  const title = 'Guests — The Bihar Vision';
  const description = 'This directory lists guests who have appeared on The Bihar Vision, added only after verification against published episodes.';

  const cardsHtml = guestRows.length
    ? `<div class="grid">${guestRows.map(({ g, episodes }) => `
    <a class="card" href="/guests/${g.slug}.html">
      ${g.photo ? `<img src="${esc(g.photo)}" alt="${esc(g.name)}" loading="lazy" width="120" height="120" style="width:120px;height:120px;object-fit:cover;border-radius:50%;">` : ''}
      <h2>${esc(g.name)}</h2>
      <p class="text-secondary">${esc(g.role || 'Guest')} · ${episodes.length} ${episodes.length === 1 ? 'episode' : 'episodes'}</p>
    </a>`).join('')}</div>`
    : `<p class="text-secondary">Guest profiles will be added after verification.</p>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${url}#webpage`, url, name: title, description },
      {
        "@type": "ItemList",
        itemListElement: guestRows.map((r, i) => ({
          "@type": "ListItem",
          position: i + 1,
          url: `${SITE_URL}/guests/${r.g.slug}.html`,
          name: r.g.name
        }))
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
          { "@type": "ListItem", position: 2, name: "Guests", item: url }
        ]
      }
    ]
  };

  return pageHead({
    title,
    description,
    canonical: url,
    ogType: 'website',
    image: null,
    jsonLd
  }) + `
  <nav class="breadcrumb container" aria-label="Breadcrumb"><a href="/">Home</a> / <span aria-current="page">Guests</span></nav>
  <section class="container">
    <p class="eyebrow">Directory</p>
    <h1>Guests</h1>
    <p class="text-secondary">${esc(description)}</p>
    ${cardsHtml}
  </section>
` + pageFoot();
}

// ---------- main ----------

function writeSitemap(urls) {
  const now = new Date().toISOString();
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(p => `  <url>
    <loc>${SITE_URL}${p.url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`).join('\n')}
</urlset>`;
  fs.writeFileSync(path.join(ROOT, 'sitemap.xml'), xml);
}

function main() {
  const episodesData = readJson(path.join(DATA_DIR, 'episodes.json'), null, true);
  const episodes = Array.isArray(episodesData.episodes) ? episodesData.episodes : [];
  const manual = readJson(path.join(DATA_DIR, 'episodes-manual.json'), {});
  const guestsData = readJson(path.join(DATA_DIR, 'guests.json'), { guests: [] });

  applyManualOverrides(episodes, manual);
  const verifiedGuests = buildGuestRegistry(guestsData);
  const items = episodes.map(ep => ({ ep, slug: ensureValidSlug(ep) }));

  // Names used in episodes that have no verified profile (shown as plain text)
  const plainNames = new Set();
  items.forEach(({ ep }) => guestNamesOf(ep).forEach(name => {
    if (!verifiedGuests.has(normalizeName(name))) plainNames.add(name.trim());
  }));
  if (plainNames.size) {
    console.log(`[generate-pages] Guest names shown as plain text (no verified profile): ${[...plainNames].join(', ')}`);
  }

  fs.mkdirSync(EPISODES_DIR, { recursive: true });
  fs.mkdirSync(GUESTS_DIR, { recursive: true });

  // Remove the broken blank file from earlier builds
  const brokenFile = path.join(EPISODES_DIR, '.html');
  if (fs.existsSync(brokenFile)) {
    fs.unlinkSync(brokenFile);
    console.log('[generate-pages] Removed previously-generated broken file: episodes/.html');
  }

  // Episode pages
  items.forEach(({ ep, slug }) => {
    fs.writeFileSync(path.join(EPISODES_DIR, `${slug}.html`), episodePageTemplate(ep, slug, verifiedGuests));
  });

  // Guest pages (verified only)
  const guestRows = [...verifiedGuests.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map(g => ({ g, episodes: episodesWithGuest(items, g.name) }));

  guestRows.forEach(({ g, episodes: eps }) => {
    fs.writeFileSync(path.join(GUESTS_DIR, `${g.slug}.html`), guestPageTemplate(g, eps));
  });

  // Remove guest pages whose guest is no longer verified
  const validSlugs = new Set(guestRows.map(r => r.g.slug));
  fs.readdirSync(GUESTS_DIR).forEach(file => {
    if (!file.endsWith('.html') || file === 'index.html') return;
    const slug = file.replace(/\.html$/, '');
    if (!validSlugs.has(slug)) {
      fs.unlinkSync(path.join(GUESTS_DIR, file));
      console.log(`[generate-pages] Removed guest page for unverified guest: guests/${file}`);
    }
  });

  // Guest directory
  fs.writeFileSync(path.join(GUESTS_DIR, 'index.html'), guestsIndexTemplate(guestRows));

  // Sitemap
  const staticPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/episodes/', priority: '0.9', changefreq: 'daily' },
    { url: '/about.html', priority: '0.8', changefreq: 'monthly' },
    { url: '/team/', priority: '0.7', changefreq: 'monthly' },
    { url: '/team/ritesh-sharma.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/team/alok-prasad.html', priority: '0.7', changefreq: 'monthly' },
    { url: '/guests/', priority: '0.6', changefreq: 'weekly' },
    { url: '/faq.html', priority: '0.5', changefreq: 'monthly' },
    { url: '/contact.html', priority: '0.6', changefreq: 'yearly' },
    { url: '/sitemap.html', priority: '0.3', changefreq: 'monthly' },
    { url: '/legal/', priority: '0.4', changefreq: 'monthly' },
    { url: '/legal/privacy-policy.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/terms-and-conditions.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/disclaimer.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/cookie-policy.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/copyright-policy.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/editorial-policy.html', priority: '0.3', changefreq: 'yearly' },
    { url: '/legal/accessibility.html', priority: '0.3', changefreq: 'yearly' }
  ];
  const guestPages = guestRows.map(({ g }) => ({ url: `/guests/${g.slug}.html`, priority: '0.6', changefreq: 'monthly' }));
  const episodePages = items.map(({ slug }) => ({ url: `/episodes/${slug}.html`, priority: '0.9', changefreq: 'monthly' }));
  const allPages = [...staticPages, ...guestPages, ...episodePages];
  writeSitemap(allPages);

  console.log(`[generate-pages] Episode pages: ${items.length}. Guest pages: ${guestRows.length}. Sitemap URLs: ${allPages.length}.`);
}

main();
