/* ============================================================
   YOUTUBE DATA LAYER
   Reads the build-time generated dataset (data/episodes.json).
   This file NEVER calls the YouTube Data API directly from the
   browser and NEVER contains an API key — live fetching happens
   only inside scripts/fetch-youtube.js during the GitHub Actions
   build (see README, Section: YouTube Integration).
   ============================================================ */
const BiharVisionData = (function () {
  let cache = null;

  async function getEpisodes() {
    if (cache) return cache;
    try {
      const res = await fetch('/data/episodes.json', { cache: 'no-store' });
      if (!res.ok) throw new Error('Dataset unavailable');
      const json = await res.json();
      cache = json.episodes.sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt));
      return cache;
    } catch (err) {
      console.warn('[BiharVision] Falling back: episode dataset could not be loaded.', err);
      return [];
    }
  }

  function formatDate(iso) {
    try {
      return new Date(iso).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch { return iso; }
  }

  function episodeCardHTML(ep) {
    const guestLine = ep.guests && ep.guests.length ? `· Guest: ${ep.guests.join(', ')}` : '';
    const thumb = ep.thumbnailUrl || `https://i.ytimg.com/vi/${ep.youtubeVideoId}/hqdefault.jpg`;
    return `
      <article class="episode-card">
        <a class="episode-thumb" href="/episodes/${ep.slug}.html" aria-hidden="true" tabindex="-1">
          <img src="${thumb}" alt="" loading="lazy" width="480" height="270"
               onerror="this.src='https://i.ytimg.com/vi/${ep.youtubeVideoId}/hqdefault.jpg'">
          ${ep.durationDisplay ? `<span class="episode-duration">${ep.durationDisplay}</span>` : ''}
        </a>
        <div class="episode-body">
          <div class="episode-meta"><span>${formatDate(ep.publishedAt)}</span><span>${guestLine}</span></div>
          <h3 class="episode-title"><a href="/episodes/${ep.slug}.html">${ep.title}</a></h3>
          <p class="episode-summary">${ep.description.slice(0, 120)}${ep.description.length > 120 ? '…' : ''}</p>
          <span class="topic-tag">${ep.topics?.[0] || 'Episode'}</span>
          <a class="episode-footer-link" href="/episodes/${ep.slug}.html">Read episode details →</a>
        </div>
      </article>`;
  }

  return { getEpisodes, episodeCardHTML, formatDate };
})();
