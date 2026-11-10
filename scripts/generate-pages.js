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
 * Episode page:
 *   - Summary limited to SUMMARY_MAX_WORDS words (hashtags and links removed),
 *     with a "Read more on YouTube" button when the text is cut
 *   - Slider of the RECENT_COUNT latest long videos (Shorts excluded), current episode left out
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

const SUMMARY_MAX_WORDS = 200;
const RECENT_COUNT = 10;
// Videos at or below this length are treated as Shorts and left out of the recent list.
// Set to 0 to include Shorts.
const SHORTS_MAX_SECONDS = 180;

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

// ---------- episode summary and duration ----------

// Returns the description as plain text, limited to maxWords words.
// Hashtags, links and asterisks are removed. "truncated" is true when words were cut.
function summaryText(description, maxWords) {
  const cleaned = String(description ?? '')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/#[^\s#]+/g, ' ')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return { text: '', truncated: false };

  const words = cleaned.split(' ');
  if (words.length <= maxWords) return { text: cleaned, truncated: false };

  return { text: words.slice(0, maxWords).join(' ') + '…', truncated: true };
}

// Accepts seconds (number), ISO 8601 (PT3M20S), plain seconds ("200") or "m:ss" / "h:mm:ss".
function parseDurationSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;

  const v = value.trim();
  if (!v) return null;

  const iso = v.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i);
  if (iso && v.length > 2) {
    return (Number(iso[1] || 0) * 3600) + (Number(iso[2] || 0) * 60) + Number(iso[3] || 0);
  }
  if (/^\d+$/.test(v)) return Number(v);
  if (/^\d+(:\d+){1,2}$/.test(v)) {
    return v.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
  }
  return null;
}

function durationSeconds(ep) {
  const fromDuration = parseDurationSeconds(ep.duration);
  if (fromDuration !== null) return fromDuration;
  return parseDurationSeconds(ep.durationDisplay);
}

function isShort(ep) {
  const seconds = durationSeconds(ep);
  return seconds !== null && seconds <= SHORTS_MAX_SECONDS;
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

// items: latest long videos (already sorted newest first), current episode may be included; it is skipped here.
function recentEpisodesHtml(items, currentEp) {
  const picks = items.filter(({ ep }) => ep !== currentEp).slice(0, RECENT_COUNT);
  if (!picks.length) return '';

  const cards = picks.map(({ ep, slug }) => `
          <a class="recent-eps-card" href="/episodes/${slug}.html">
            ${ep.thumbnailUrl ? `<img src="${esc(ep.thumbnailUrl)}" alt="" loading="lazy" width="320" height="180">` : ''}
            <h3>${esc(ep.title)}</h3>
            <p class="text-secondary">${esc(String(ep.publishedAt || '').slice(0, 10))}</p>
          </a>`).join('');

  return `
  <section class="container recent-eps" aria-labelledby="recent-eps-title">
    <style>
      .recent-eps{max-width:860px;margin:2.5rem auto 0;}
      .recent-eps h2{margin:0 0 1rem;}
      .recent-eps-wrap{position:relative;}
      .recent-eps-track{display:flex;gap:1rem;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:.25rem 0 1rem;-webkit-overflow-scrolling:touch;}
      .recent-eps-card{flex:0 0 60%;min-width:0;scroll-snap-align:start;text-decoration:none;color:#2B1B12;border-radius:10px;}
      .recent-eps-card img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;}
      .recent-eps-card h3{font-size:.95rem;line-height:1.35;margin:.5rem 0 .25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .recent-eps-card p{margin:0;font-size:.85rem;}
      .recent-eps-card:hover h3{color:#B5502D;}
      .recent-eps-card:focus-visible,.recent-eps-track:focus-visible,.recent-eps-btn:focus-visible{outline:3px solid #B5502D;outline-offset:3px;}
      .recent-eps-btn{display:none;position:absolute;top:50%;transform:translateY(-50%);z-index:1;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:1px solid #D9C7A3;background:#FFFFFF;color:#2E4057;font-size:1.6rem;line-height:1;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,.12);padding:0;}
      .recent-eps-btn:disabled{opacity:.35;cursor:default;}
      .recent-eps-prev{left:-14px;}
      .recent-eps-next{right:-14px;}
      @media (min-width:600px){
        .recent-eps-card{flex-basis:calc((100% - 2rem) / 3);}
        .recent-eps-btn{display:flex;}
      }
      @media (min-width:900px){
        .recent-eps-card{flex-basis:calc((100% - 4rem) / 5);}
      }
    </style>
    <h2 id="recent-eps-title">Recent episodes</h2>
    <div class="recent-eps-wrap">
      <button type="button" class="recent-eps-btn recent-eps-prev" aria-label="Show previous episodes">&#8249;</button>
      <div class="recent-eps-track" id="recent-eps-track" tabindex="0" role="region" aria-label="Recent episodes">${cards}
      </div>
      <button type="button" class="recent-eps-btn recent-eps-next" aria-label="Show next episodes">&#8250;</button>
    </div>
  </section>
  <script>
    (function () {
      var track = document.getElementById('recent-eps-track');
      var prev = document.querySelector('.recent-eps-prev');
      var next = document.querySelector('.recent-eps-next');
      if (!track || !prev || !next) return;

      function step() {
        var card = track.querySelector('.recent-eps-card');
        return card ? card.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
      }
      function update() {
        var max = track.scrollWidth - track.clientWidth - 2;
        prev.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= max;
      }
      prev.addEventListener('click', function () {
        track.scrollBy({ left: -step(), behavior: 'smooth' });
      });
      next.addEventListener('click', function () {
        track.scrollBy({ left: step(), behavior: 'smooth' });
      });
      track.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      update();
    })();
  </script>`;
}

function episodePageTemplate(ep, slug, verifiedGuests, recentItems) {
  const title = ep.seoTitle || ep.title || 'Episode';
  const description = ep.seoDescription || ep.description || '';
  const canonical = `${SITE_URL}/episodes/${slug}.html`;
  const names = guestNamesOf(ep);

  const topics = Array.isArray(ep.topics) && ep.topics.length
    ? ep.topics.map(t => esc(t)).join(' · ')
    : 'Episode';

  const summary = summaryText(ep.description, SUMMARY_MAX_WORDS);
  const summaryHtml = summary.text
    ? `<h2>Episode Summary</h2><p>${esc(summary.text)}</p>${summary.truncated
        ? `<p><a class="btn btn-outline" href="${esc(ep.youtubeUrl)}" target="_blank" rel="noopener">Read more on YouTube</a></p>`
        : ''}`
    : '';

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
    ${summaryHtml}
    <h2>Host &amp; Guests</h2><p><strong>Host:</strong> ${hostProfileLink(ep.host)}${names.length ? `<br><strong>Guests:</strong> ${guestsLineHtml(names, verifiedGuests)}` : ''}</p>
  </article>
  ${recentEpisodesHtml(recentItems, ep)}
` + pageFoot();
}

// ---------- guest pages ----------

function episodeCardsHtml(items) {
  if (!items.length) {
    return `<p class="text-secondary">No episodes are linked to this guest yet.</p>`;
  }
  return `
    <style>
      .guest-ep-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.25rem .75rem;margin-top:1rem;}
      .guest-ep-card{display:block;text-decoration:none;color:#2B1B12;border-radius:10px;}
      .guest-ep-card img{display:block;width:100%;height:auto;aspect-ratio:16/9;object-fit:cover;border-radius:10px;}
      .guest-ep-card h3{font-size:.95rem;line-height:1.35;margin:.5rem 0 .25rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
      .guest-ep-card p{margin:0;font-size:.85rem;}
      .guest-ep-card:hover h3{color:#B5502D;}
      .guest-ep-card:focus-visible{outline:3px solid #B5502D;outline-offset:3px;}
      @media (min-width:900px){
        .guest-ep-grid{grid-template-columns:repeat(4,minmax(0,1fr));}
      }
    </style>
    <div class="guest-ep-grid">${items.map(({ ep, slug }) => `
    <a class="guest-ep-card" href="/episodes/${slug}.html">
      ${ep.thumbnailUrl ? `<img src="${esc(ep.thumbnailUrl)}" alt="" loading="lazy" width="320" height="180">` : ''}
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

  // ProfilePage wraps the Person (mainEntity), which is the structure Google's
  // "Profile page" enhancement reads. BreadcrumbList is a separate entry in the same graph.
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ProfilePage",
        "@id": `${canonical}#webpage`,
        url: canonical,
        name: title,
        description,
        breadcrumb: { "@id": `${canonical}#breadcrumb` },
        mainEntity: {
          "@type": "Person",
          "@id": `${canonical}#person`,
          name: g.name,
          jobTitle: g.role || undefined,
          description,
          image: g.photo ? absUrl(g.photo) : undefined,
          url: canonical,
          sameAs: links.length ? links : undefined
        }
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${canonical}#breadcrumb`,
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

  // Alphabetical by name
  const sorted = [...guestRows].sort((a, b) => a.g.name.localeCompare(b.g.name, 'en', { sensitivity: 'base' }));

  const roles = [...new Set(sorted.map(r => (r.g.role || 'Guest').trim()))]
    .sort((a, b) => a.localeCompare(b, 'en', { sensitivity: 'base' }));
  const roleOptions = roles
    .map(r => `<option value="${esc(r.toLowerCase())}">${esc(r)}</option>`)
    .join('');

  const cardsHtml = sorted.map(({ g, episodes }) => {
    const role = (g.role || 'Guest').trim();
    const photo = g.photo
      ? `<img src="${esc(g.photo)}" alt="${esc(g.name)}" loading="lazy" width="160" height="160">`
      : `<span class="guest-dir-noimg" aria-hidden="true">${esc(g.name.charAt(0).toUpperCase())}</span>`;
    return `
    <a class="guest-dir-card" href="/guests/${g.slug}.html" data-name="${esc(g.name.toLowerCase())}" data-role="${esc(role.toLowerCase())}">
      ${photo}
      <h2>${esc(g.name)}</h2>
      <p class="text-secondary">${esc(role)} · ${episodes.length} ${episodes.length === 1 ? 'episode' : 'episodes'}</p>
    </a>`;
  }).join('');

  const directoryHtml = sorted.length
    ? `
    <style>
      .guest-dir{display:flex;flex-direction:column;gap:1.25rem;margin-top:1.5rem;}
      .guest-dir-filter{background:#F2E6D0;border:1px solid #D9C7A3;border-radius:12px;padding:1rem;}
      .guest-dir-filter-title{font-weight:700;margin:0 0 .75rem;color:#2B1B12;}
      .guest-dir-fields{display:flex;flex-wrap:wrap;gap:.75rem;align-items:flex-end;}
      .guest-dir-field{flex:1 1 200px;min-width:0;}
      .guest-dir-field label{display:block;font-weight:600;margin:0 0 .35rem;color:#2B1B12;font-size:.9rem;}
      .guest-dir-field input,.guest-dir-field select{width:100%;padding:.6rem .7rem;border:1px solid #D9C7A3;border-radius:8px;background:#FFFFFF;color:#2B1B12;font:inherit;box-sizing:border-box;}
      .guest-dir-actions{flex:0 0 auto;}
      .guest-dir-actions button{padding:.6rem 1rem;border:1px solid #B5502D;border-radius:8px;background:transparent;color:#B5502D;font:inherit;cursor:pointer;white-space:nowrap;}
      .guest-dir-count{margin:0 0 1rem;}
      .guest-dir-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1.5rem 1rem;}
      .guest-dir-card{display:flex;flex-direction:column;align-items:center;text-align:center;text-decoration:none;color:#2B1B12;padding:.5rem;border-radius:12px;}
      .guest-dir-card[hidden]{display:none !important;}
      .guest-dir-card:hover h2{color:#B5502D;}
      .guest-dir-card:focus-visible{outline:3px solid #B5502D;outline-offset:3px;}
      .guest-dir-card img,.guest-dir-noimg{width:100%;max-width:160px;aspect-ratio:1/1;height:auto;border-radius:50%;object-fit:cover;}
      .guest-dir-noimg{display:flex;align-items:center;justify-content:center;background:#2E4057;color:#FBF6EC;font-size:2.5rem;font-weight:700;}
      .guest-dir-card h2{font-size:1.05rem;margin:.6rem 0 .2rem;}
      .guest-dir-card p{margin:0;font-size:.9rem;}
      @media (min-width:600px) and (max-width:899px){
        .guest-dir-grid{grid-template-columns:repeat(3,minmax(0,1fr));}
      }
      @media (min-width:900px){
        .guest-dir-grid{grid-template-columns:repeat(4,minmax(0,1fr));}
      }
    </style>
    <div class="guest-dir">
      <aside class="guest-dir-filter" aria-label="Filter guests">
        <p class="guest-dir-filter-title">Filter guests</p>
        <div class="guest-dir-fields">
          <div class="guest-dir-field">
            <label for="guest-search">Search by name</label>
            <input id="guest-search" type="search" placeholder="Type a name" autocomplete="off">
          </div>
          <div class="guest-dir-field">
            <label for="guest-role">Role</label>
            <select id="guest-role">
              <option value="">All roles</option>
              ${roleOptions}
            </select>
          </div>
          <div class="guest-dir-field guest-dir-actions">
            <button type="button" id="guest-reset">Clear filter</button>
          </div>
        </div>
      </aside>
      <div>
        <p class="text-secondary guest-dir-count" id="guest-count" aria-live="polite">Showing ${sorted.length} of ${sorted.length} ${sorted.length === 1 ? 'guest' : 'guests'}</p>
        <div class="guest-dir-grid" id="guest-grid">${cardsHtml}</div>
        <p class="text-secondary" id="guest-empty" hidden>No guests match this filter.</p>
      </div>
    </div>
    <script>
      (function () {
        var search = document.getElementById('guest-search');
        var role = document.getElementById('guest-role');
        var reset = document.getElementById('guest-reset');
        var cards = Array.prototype.slice.call(document.querySelectorAll('.guest-dir-card'));
        var empty = document.getElementById('guest-empty');
        var count = document.getElementById('guest-count');

        function apply() {
          var q = search.value.trim().toLowerCase();
          var r = role.value;
          var shown = 0;
          cards.forEach(function (c) {
            var ok = (!q || c.getAttribute('data-name').indexOf(q) !== -1) &&
                     (!r || c.getAttribute('data-role') === r);
            c.hidden = !ok;
            if (ok) shown++;
          });
          empty.hidden = shown !== 0;
          count.textContent = 'Showing ' + shown + ' of ' + cards.length + (cards.length === 1 ? ' guest' : ' guests');
        }

        search.addEventListener('input', apply);
        role.addEventListener('change', apply);
        reset.addEventListener('click', function () {
          search.value = '';
          role.value = '';
          apply();
        });
      })();
    </script>`
    : `<p class="text-secondary">Guest profiles will be added after verification.</p>`;

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "CollectionPage", "@id": `${url}#webpage`, url, name: title, description },
      {
        "@type": "ItemList",
        itemListElement: sorted.map((r, i) => ({
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
    ${directoryHtml}
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

  // Newest long videos for the "Recent episodes" slider (Shorts excluded)
  const recentPool = items
    .filter(({ ep }) => !isShort(ep))
    .sort((a, b) => String(b.ep.publishedAt || '').localeCompare(String(a.ep.publishedAt || '')));
  const shortsCount = items.length - recentPool.length;

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
    fs.writeFileSync(path.join(EPISODES_DIR, `${slug}.html`), episodePageTemplate(ep, slug, verifiedGuests, recentPool));
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

  console.log(`[generate-pages] Episode pages: ${items.length}. Guest pages: ${guestRows.length}. Sitemap URLs: ${allPages.length}. Shorts left out of recent list: ${shortsCount}.`);
}

main();
