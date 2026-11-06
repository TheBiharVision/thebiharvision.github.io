/**
 * Runs ONLY in GitHub Actions (server-side build step).
 * Reads YOUTUBE_API_KEY from a GitHub Actions secret (never committed, never shipped to the browser).
 *
 * What it does:
 *   1. Reads every video in the channel's uploads playlist, following nextPageToken
 *      until there are no more pages (so older videos are included, not only the latest 50).
 *   2. Fetches details for those videos in batches of 50.
 *   3. Skips YouTube Shorts (60 seconds or less) unless INCLUDE_SHORTS is true.
 *   4. Merges each video with manually-curated metadata (host, guests, topics, chapters, slug, ...)
 *      from data/episodes-manual.json, keyed by YouTube video ID.
 *   5. Writes data/episodes.json.
 *
 * Falls back to leaving data/episodes.json untouched if the API key is missing,
 * the API request fails, the manual file is invalid, or no videos remain after filtering.
 */
const fs = require('fs');
const path = require('path');
const anyAsciiModule = require('any-ascii');
const anyAscii = typeof anyAsciiModule === 'function' ? anyAsciiModule : anyAsciiModule.default;

const API_KEY = process.env.YOUTUBE_API_KEY; // set via GitHub Secrets — never hardcode
const CHANNEL_ID = 'UCq-dySuxc46S5BpDQuRGt_A';
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const DATA_PATH = path.join(__dirname, '../data/episodes.json');
const MANUAL_PATH = path.join(__dirname, '../data/episodes-manual.json');

// Set to true to keep YouTube Shorts in data/episodes.json
const INCLUDE_SHORTS = true;
const SHORTS_MAX_SECONDS = 60;

/**
 * Converts any title (English, Hindi, Bhojpuri/Devanagari, mixed) into a
 * clean, URL-safe, lowercase slug. Non-Latin scripts are transliterated first.
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
 * - Empty slug falls back to "episode".
 * - A collision with a slug already used in this run gets a short video-ID suffix.
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

/**
 * Converts an ISO 8601 duration (for example "PT1M30S") into seconds.
 * Returns null if the format is not recognised.
 */
function parseDurationSeconds(iso) {
  const match = /^P(?:(\d+)D)?T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return null;
  const days = Number(match[1] || 0);
  const hours = Number(match[2] || 0);
  const minutes = Number(match[3] || 0);
  const seconds = Number(match[4] || 0);
  return days * 86400 + hours * 3600 + minutes * 60 + seconds;
}

async function apiGet(endpoint, params) {
  const query = new URLSearchParams({ ...params, key: API_KEY });
  const res = await fetch(`${API_BASE}/${endpoint}?${query.toString()}`);
  const json = await res.json();
  if (json.error) {
    throw new Error(`YouTube API ${endpoint} error: ${JSON.stringify(json.error)}`);
  }
  return json;
}

/** Returns every video ID in the uploads playlist, across all pages. */
async function fetchUploadVideoIds(uploadsPlaylistId) {
  const ids = [];
  let pageToken = null;

  do {
    const params = {
      part: 'contentDetails',
      maxResults: 50,
      playlistId: uploadsPlaylistId
    };
    if (pageToken) params.pageToken = pageToken;

    const page = await apiGet('playlistItems', params);
    for (const item of page.items || []) {
      const id = item.contentDetails?.videoId;
      if (id) ids.push(id);
    }
    pageToken = page.nextPageToken || null;
  } while (pageToken);

  return [...new Set(ids)];
}

/** Returns full details (snippet and contentDetails) for the given video IDs, in batches of 50. */
async function fetchVideoDetails(ids) {
  const videos = [];
  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const json = await apiGet('videos', {
      part: 'contentDetails,snippet',
      id: chunk.join(',')
    });
    videos.push(...(json.items || []));
  }
  return videos;
}

function readManual() {
  if (!fs.existsSync(MANUAL_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8'));
  } catch (err) {
    throw new Error(`episodes-manual.json is not valid JSON: ${err.message}`);
  }
}

async function main() {
  if (!API_KEY) {
    console.warn('[fetch-youtube] YOUTUBE_API_KEY not set — skipping live fetch, keeping existing dataset (fallback mode).');
    return;
  }

  try {
    const channel = await apiGet('channels', { part: 'contentDetails', id: CHANNEL_ID });
    const uploadsPlaylistId = channel.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) {
      throw new Error('Uploads playlist not found for this channel.');
    }

    const videoIds = await fetchUploadVideoIds(uploadsPlaylistId);
    console.log(`[fetch-youtube] Uploads found in channel playlist: ${videoIds.length}`);

    const videos = await fetchVideoDetails(videoIds);
    console.log(`[fetch-youtube] Video details fetched: ${videos.length}`);

    // Newest first, so if two titles produce the same slug the newer video keeps the plain one
    videos.sort((a, b) => String(b.snippet.publishedAt).localeCompare(String(a.snippet.publishedAt)));

    let shortsSkipped = 0;
    const selected = videos.filter(video => {
      const secs = parseDurationSeconds(video.contentDetails?.duration);
      const isShort = secs !== null && secs <= SHORTS_MAX_SECONDS;
      if (isShort && !INCLUDE_SHORTS) {
        shortsSkipped++;
        return false;
      }
      return true;
    });

    if (selected.length === 0) {
      throw new Error('No videos left after filtering. Keeping existing dataset.');
    }

    const manual = readManual();
    const usedSlugs = new Set();

    const episodes = selected.map(video => {
      const overrides = manual[video.id] || {};
      const slug = overrides.slug || buildUniqueSlug(video.snippet.title, video.id, usedSlugs);

      return {
        id: video.id,
        slug,
        title: video.snippet.title,
        description: video.snippet.description,
        youtubeVideoId: video.id,
        youtubeUrl: `https://www.youtube.com/watch?v=${video.id}`,
        thumbnailUrl: video.snippet.thumbnails?.maxres?.url
          || video.snippet.thumbnails?.high?.url
          || video.snippet.thumbnails?.default?.url,
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

    fs.writeFileSync(
      DATA_PATH,
      JSON.stringify({ _dataset: 'LIVE — generated from YouTube Data API v3', episodes }, null, 2)
    );
    console.log(`[fetch-youtube] Wrote ${episodes.length} episodes to data/episodes.json (Shorts skipped: ${shortsSkipped}).`);
  } catch (err) {
    console.error('[fetch-youtube] Fetch failed — keeping existing dataset (fallback mode).', err.message);
  }
}

main();
