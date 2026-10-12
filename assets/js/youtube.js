function episodeCardHTML(ep) {
  const safeSlug = ep.slug || `episode-${ep.id || ''}`.toLowerCase().replace(/[^a-z0-9-]/g, '');
  const guestLine = ep.guests && ep.guests.length ? `· Guest: ${ep.guests.join(', ')}` : '';
  const thumb = ep.thumbnailUrl || `https://i.ytimg.com/vi/${ep.youtubeVideoId}/hqdefault.jpg`;
  return `
    <article class="episode-card">
      <a class="episode-thumb" href="/episodes/${safeSlug}.html" aria-hidden="true" tabindex="-1">
        <img src="${thumb}" alt="" loading="lazy" width="480" height="270"
             onerror="this.src='https://i.ytimg.com/vi/${ep.youtubeVideoId}/hqdefault.jpg'">
        ${ep.durationDisplay ? `<span class="episode-duration">${ep.durationDisplay}</span>` : ''}
      </a>
      <div class="episode-body">
        <div class="episode-meta"><span>${formatDate(ep.publishedAt)}</span><span>${guestLine}</span></div>
        <h3 class="episode-title"><a href="/episodes/${safeSlug}.html">${ep.title}</a></h3>
        <p class="episode-summary">${ep.description.slice(0, 120)}${ep.description.length > 120 ? '…' : ''}</p>
        <span class="topic-tag">${ep.topics?.[0] || 'Episode'}</span>
        <a class="episode-footer-link" href="/episodes/${safeSlug}.html">Read episode details →</a>
      </div>
    </article>`;
}
