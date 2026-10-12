/**
 * Runs ONLY in GitHub Actions (server-side build step).
 * Reads YOUTUBE_API_KEY from a GitHub Actions secret (never committed, never shipped to the browser).
 * Fetches latest uploads from the channel and merges them with manually-curated metadata
 * (host, guests, topics, chapters) stored in data/episodes-manual.json.
 * Falls back to leaving data/episodes.json untouched if the API key is missing or quota is exceeded.
 *
 * FIX: Hindi/Devanagari (and any non-Latin script) titles are now transliterated to
 * Roman characters using any-ascii before slugifying, so slugs are never empty.
 * A collision/empty safety net guarantees every episode gets a valid, unique slug.
 */
const fs = require('fs');
const path = require('path');
const anyAscii = require('any-ascii');

const API_KEY = process.env.YOUTUBE_API_KEY; // set via GitHub Secrets — never hardcode
const CHANNEL_ID = 'UCq-dySuxc46S5BpDQuRGt_A';
const DATA_PATH = path.join(__dirname, '../data/episodes.json');
const MANUAL_PATH = path.join(__dirname, '../data/episodes-manual.json');

/**
 * Converts any title (English, Hindi, Bhojpuri/Devanagari, mixed) into a
 * clean, URL-safe, lowercase slug. Non-Latin scripts are transliterated
 * to approximate Roman characters first.
 */
function slugify(title) {
  const transliterated = anyAscii(title || '');
  return transliterated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70);
}

/**
 * Ensures every episode gets a non-empty, unique slug.
 * - If slugify() returns empty (e.g. title had no transliterable characters), fall back to "episode".
 * - If the resulting slug collides with one already used in this batch, append a short video-ID suffix.
 */
function buildUniqueSlug(title, videoId, usedSlugs) {
  let slug = slugify(title);
  if (!slug) {
    slug = 'episode';
  }
  if (usedSlugs.has(slug)) {
    const suffix = videoId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toLowerCase();
    slug = `${slug}-${suffix}`;
  }
  usedSlugs.add(slug);
  return slug;
}

async function main() {
  if (!API_KEY) {
    console.warn('[fetch-youtube] YOUTUBE_API_KEY not set — skipping live fetch, keeping existing dataset (fallback mode).');
    return;
  }

  try {
    const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${CHANNEL_ID}&key=${API_KEY}`);
    const channelJson = await channelRes.json();
    if (channelJson.error) throw new Error(JSON.stringify(channelJson.error));

    const uploadsPlaylistId = channelJson.items[0].contentDetails.relatedPlaylists.uploads;

    const videosRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet,contentDetails&maxResults=50&playlistId=${uploadsPlaylistId}&key=${API_KEY}`);
    const videosJson = await videosRes.json();
    if (videosJson.error) throw new Error(JSON.stringify(videosJson.error));

    const ids = videosJson.items.map(i => i.contentDetails.videoId).join(',');
    const detailsRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=contentDetails,snippet&id=${ids}&key=${API_KEY}`);
    const detailsJson = await detailsRes.json();

    const manual = fs.existsSync(MANUAL_PATH) ? JSON.parse(fs.readFileSync(MANUAL_PATH)) : {};
    const usedSlugs = new Set();

    const episodes = detailsJson.items.map(video => {
      const overrides = manual[video.id] || {};
      const slug = overrides.slug || buildUniqueSlug(video.snippet.title, video.id, usedSlugs);

      return {
        id: video.id,
        slug,
        title: video.snippet.title,
        description: video.snippet.description,
        youtubeVideoId: video.id,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl: video.snippet.thumbnails?.maxres?.url || video.snippet.thumbnails?.high?.url,
        publishedAt: video.snippet.publishedAt.split('T')[0],
        duration: video.contentDetails.duration,
        durationDisplay: overrides.durationDisplay || null,
        host: overrides.host || 'Alok Prasad',
        guests: overrides.guests || [],
        topics: overrides.topics || [],
        chapters: overrides.chapters || [],
        transcript: overrides.transcript || null,
        sources: overrides.sources || [],
        featured: overrides.featured || false,
        seoTitle: overrides.seoTitle || `${video.snippet.title} | The Bihar Vision`,
        seoDescription: overrides.seoDescription || (video.snippet.description || '').slice(0, 155)
      };
    });

    fs.writeFileSync(DATA_PATH, JSON.stringify({ _dataset: 'LIVE — generated from YouTube Data API v3', episodes }, null, 2));
    console.log(`[fetch-youtube] Wrote ${episodes.length} episodes to data/episodes.json`);
  } catch (err) {
    console.error('[fetch-youtube] Fetch failed — keeping existing dataset (fallback mode).', err.message);
  }
}

main();
