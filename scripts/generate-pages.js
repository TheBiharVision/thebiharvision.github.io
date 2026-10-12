/**
 * Generates one static, indexable HTML page per episode in data/episodes.json,
 * using the template structure documented in episodes/bihar-folk-music-revival-with-guest.html.
 * Also regenerates sitemap.xml with every episode URL.
 * Run: node scripts/generate-pages.js
 *
 * SAFETY NET: if an episode has a missing/invalid slug (e.g. manually added without
 * running fetch-youtube.js, or an all-Hindi title that wasn't transliterated), this
 * script falls back to an id-based slug and logs a clear warning instead of silently
 * producing a broken "/episodes/.html" file.
 */
const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://thebiharvision.github.io';
const episodesData = JSON.parse(fs.readFileSync(path.join(__dirname, '../data/episodes.json')));
const OUT_DIR = path.join(__dirname, '../episodes');

function ensureValidSlug(ep) {
  const isValid = ep.slug && /^[a-z0-9-]+$/.test(ep.slug);
  if (isValid) return ep.slug;

  const fallback = `episode-${(ep.id || 'unknown').toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  console.warn(`[generate-pages] WARNING: Episode "${ep.title}" (id: ${ep.id}) has a missing/invalid slug ("${ep.slug}"). Using fallback slug: "${fallback}". Fix this in data/episodes.json or re-run scripts/fetch-youtube.js.`);
  return fallback;
}

function episodePageTemplate(ep, slug) {
  const chaptersHtml = ep.chapters?.length
    ? `<ul>${ep.chapters.map(c => `<li>${c.time} — ${c.label}</li>`).join('')}</ul>`
    : `<p class="text-secondary">Chapter timestamps are not yet available for this episode. <span class="badge-dark">Unconfirmed</span></p>`;

  const transcriptHtml = ep.transcript
    ? `<div>${ep.transcript}</div>`
    : `<p class="text-secondary">A transcript is not currently available for this episode.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${ep.seoTitle}</title>
<meta name="description" content="${ep.seoDescription}">
<link rel="canonical" href="${SITE_URL}/episodes/${slug}.html">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="index, follow">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${ep.seoTitle}">
<meta property="og:description" content="${ep.seoDescription}">
<meta property="og:image" content="${ep.thumbnailUrl}">
<meta property="og:url" content="${SITE_URL}/episodes/${slug}.html">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="https://yt3.googleusercontent.com/AP6H5C_wCpt12OHrWK462FPNC7hil_35pnCHDnADD7OSGvSu-sKJUEl-eS_lNP2LIBMRlcso=s160-c-k-c0x00ffffff-no-rj">
<link rel="stylesheet" href="/assets/css/style.css">
<script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: ep.title,
  description: ep.description,
  thumbnailUrl: [ep.thumbnailUrl],
  uploadDate: ep.publishedAt,
  duration: ep.duration,
  embedUrl: `https://www.youtube-nocookie.com/embed/${ep.youtubeVideoId}`,
  contentUrl: ep.youtubeUrl,
  publisher: { "@type": "Organization", name: "The Bihar Vision" }
}, null, 2)}
</script>
</head>
<body>
<header id="site-header"></header>
<main id="main-content">
  <nav class="breadcrumb container" aria-label="Breadcrumb"><a href="/">Home</a> / <a href="/episodes/">Episodes</a> / <span aria-current="page">${ep.title}</span></nav>
  <article class="container" style="max-width:860px;">
    <p class="eyebrow">${(ep.topics || []).join(' · ') || 'Episode'}</p>
    <h1>${ep.title}</h1>
    <p class="text-secondary">Published ${ep.publishedAt}${ep.durationDisplay ? ' · ' + ep.durationDisplay : ''} · Hosted by ${ep.host}</p>
    <div class="video-frame" style="margin:1.5rem 0;">
      <iframe src="https://www.youtube-nocookie.com/embed/${ep.youtubeVideoId}" title="${ep.title} | The Bihar Vision" loading="lazy" allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
    </div>
    <a class="btn btn-outline" href="${ep.youtubeUrl}" target="_blank" rel="noopener">Watch on YouTube</a>
    <h2>Episode Summary</h2><p>${ep.description}</p>
    <h2>Host &amp; Guests</h2><p><strong>Host:</strong> ${ep.host}${ep.guests?.length ? `<br><strong>Guests:</strong> ${ep.guests.join(', ')}` : ''}</p>
    <h2>Chapters</h2>${chaptersHtml}
    <h2>Transcript</h2>${transcriptHtml}
  </article>
</main>
<footer id="site-footer"></footer>
<script src="/assets/js/config.js"></script>
<script src="/assets/js/components.js"></script>
<script src="/assets/js/main.js"></script>
</body>
</html>`;
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// Clean up previously-generated broken files (e.g. the old blank "episodes/.html")
const brokenFile = path.join(OUT_DIR, '.html');
if (fs.existsSync(brokenFile)) {
  fs.unlinkSync(brokenFile);
  console.log('[generate-pages] Removed previously-generated broken file: episodes/.html');
}

const finalUrls = [];
episodesData.episodes.forEach(ep => {
  const slug = ensureValidSlug(ep);
  fs.writeFileSync(path.join(OUT_DIR, `${slug}.html`), episodePageTemplate(ep, slug));
  finalUrls.push(`/episodes/${slug}.html`);
});

// Regenerate sitemap.xml
const staticUrls = [
  '/', '/episodes/', '/about.html', '/team/ritesh-sharma.html', '/team/alok-prasad.html',
  '/guests/', '/faq.html', '/contact.html', '/sitemap.html',
  '/legal/privacy-policy.html', '/legal/terms-and-conditions.html', '/legal/disclaimer.html',
  '/legal/cookie-policy.html', '/legal/copyright-policy.html', '/legal/editorial-policy.html', '/legal/accessibility.html'
];
const allUrls = [...staticUrls, ...finalUrls];

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url><loc>${SITE_URL}${u}</loc></url>`).join('\n')}
</urlset>`;
fs.writeFileSync(path.join(__dirname, '../sitemap.xml'), xml);

console.log(`[generate-pages] Generated ${finalUrls.length} episode pages and sitemap.xml`);
