/* Client-side search over the published episode dataset. */
document.addEventListener('DOMContentLoaded', async () => {
  const form = document.getElementById('search-form');
  const input = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  const emptyState = document.getElementById('search-empty');
  const clearBtn = document.getElementById('search-clear');
  if (!form || !results) return;

  const episodes = await BiharVisionData.getEpisodes();
  const params = new URLSearchParams(window.location.search);
  const initialQ = params.get('q') || '';
  if (initialQ) input.value = initialQ;

  function runSearch(q) {
    results.innerHTML = '';
    emptyState.hidden = true;
    const query = q.trim().toLowerCase();
    if (!query) { results.setAttribute('aria-label', 'Search results'); return; }

    const matches = episodes.filter(ep =>
      ep.title.toLowerCase().includes(query) ||
      ep.description.toLowerCase().includes(query) ||
      (ep.topics || []).some(t => t.toLowerCase().includes(query)) ||
      (ep.guests || []).some(g => g.toLowerCase().includes(query))
    );

    if (!matches.length) {
      emptyState.hidden = false;
      results.setAttribute('aria-label', `No results for ${q}`);
      return;
    }

    results.setAttribute('aria-label', `${matches.length} results for ${q}`);
    results.innerHTML = matches.map(BiharVisionData.episodeCardHTML).join('');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    history.replaceState(null, '', `/search/?q=${encodeURIComponent(input.value)}`);
    runSearch(input.value);
  });

  clearBtn.addEventListener('click', () => {
    input.value = '';
    history.replaceState(null, '', '/search/');
    results.innerHTML = '';
    emptyState.hidden = true;
    input.focus();
  });

  if (initialQ) runSearch(initialQ);
});
