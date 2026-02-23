/**
 * External API integration for TMDB and RAWG.
 * Fetches metadata and caches results locally.
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const REFRESH = process.env.REFRESH_EXTERNAL_DATA === "true";
const CACHE_SCHEMA_VERSION = 8;

const CACHE_DIR = path.join(__dirname, "../_data/.cache");
const CACHE_FILE = path.join(CACHE_DIR, "external-data.json");

if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

function loadCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const data = fs.readFileSync(CACHE_FILE, "utf8");
      return JSON.parse(data);
    } catch (err) {
      console.warn("Could not parse cache file, starting fresh:", err.message);
      return {};
    }
  }
  return {};
}

function saveCache(data) {
  fs.writeFileSync(CACHE_FILE, JSON.stringify(data, null, 2));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJsonWithRetry(url, { label = "request", attempts = 3, backoffMs = 350 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`${label} failed with status ${response.status}`);
      }
      return await response.json();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        await sleep(backoffMs * attempt);
      }
    }
  }

  throw lastError || new Error(`${label} failed`);
}

async function fetchYouTubeApiTrailer(title, year, type) {
  if (!YOUTUBE_API_KEY) return null;

  const query = [
    title,
    year,
    type === "game" ? "official gameplay trailer" : "official trailer",
  ]
    .filter(Boolean)
    .join(" ");

  const url =
    "https://www.googleapis.com/youtube/v3/search?" +
    `part=snippet&type=video&videoEmbeddable=true&maxResults=10&safeSearch=strict` +
    `&q=${encodeURIComponent(query)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;

  try {
    const data = await fetchJsonWithRetry(url, {
      label: `YouTube Data API search (${title})`,
      attempts: 3,
    });
    const items = Array.isArray(data?.items) ? data.items : [];
    if (items.length === 0) return null;

    const normalizedTitle = normalizeTitle(title);
    const scoreItem = (item) => {
      const snippet = item?.snippet || {};
      const rawName = `${snippet.title || ""} ${snippet.description || ""}`;
      const videoTitle = normalizeTitle(rawName);
      let score = 0;

      if (videoTitle.includes(normalizedTitle)) score += 60;
      const yearStr = String(year || "");
      if (yearStr && rawName.includes(yearStr)) score += 20;
      if (/official/i.test(rawName)) score += 15;
      if (/trailer|gameplay|launch/i.test(rawName)) score += 10;
      if (/reaction|breakdown|explained|fan made|recap/i.test(rawName)) score -= 40;

      return score;
    };

    const best = items.sort((a, b) => scoreItem(b) - scoreItem(a))[0];
    const videoId = best?.id?.videoId;
    if (!videoId) return null;

    return {
      trailer_url: `https://www.youtube.com/watch?v=${videoId}`,
      trailer_site: "youtube-api",
      trailer_label: best?.snippet?.title || (type === "game" ? "Gameplay Trailer" : "Official Trailer"),
    };
  } catch (err) {
    console.warn(`YouTube API trailer fetch error for "${title}":`, err.message);
    return null;
  }
}

function normalizeTitle(value) {
  if (!value) return "";

  const romanMap = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
  };

  return String(value)
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(i|ii|iii|iv|v|vi|vii|viii|ix|x)\b/g, (m) => romanMap[m] || m)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanSearchTitle(value) {
  if (!value) return "";
  return String(value)
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/:\s*Season\s+\d+|Season\s+\d+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseYearFromDate(dateValue) {
  if (!dateValue) return null;
  const year = Number(String(dateValue).slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

function scoreTitleMatch(queryTitle, candidateTitle) {
  const query = normalizeTitle(queryTitle);
  const candidate = normalizeTitle(candidateTitle);

  if (!query || !candidate) return -1000;
  if (query === candidate) return 200;

  let score = 0;

  if (candidate.includes(query) || query.includes(candidate)) {
    score += 45;
  }

  if (candidate.startsWith(query) || query.startsWith(candidate)) {
    score += 25;
  }

  const qTokens = new Set(query.split(" ").filter(Boolean));
  const cTokens = new Set(candidate.split(" ").filter(Boolean));
  const qCount = qTokens.size || 1;
  const cCount = cTokens.size || 1;

  let overlap = 0;
  for (const token of qTokens) {
    if (cTokens.has(token)) overlap++;
  }

  score += Math.round((overlap / qCount) * 60);
  score -= Math.max(0, cCount - qCount) * 8;
  return score;
}

function isLikelySupplementalGameEntry(game) {
  const text = normalizeTitle(`${game?.name || ""} ${game?.slug || ""}`);
  const blockedPhrases = [
    "character creator",
    "storage",
    "demo",
    "beta",
    "alpha",
    "test",
    "soundtrack",
    "season pass",
    "expansion",
    "dlc",
    "bundle",
    "pack",
    "ps1",
    "gb",
    "mod",
  ];
  return blockedPhrases.some((phrase) => text.includes(phrase));
}

function scoreYearMatch(expectedYear, candidateDate) {
  const candidateYear = parseYearFromDate(candidateDate);
  if (!expectedYear || !candidateYear) return 0;

  const diff = Math.abs(Number(expectedYear) - candidateYear);
  if (diff === 0) return 25;
  if (diff === 1) return 10;
  if (diff === 2) return 3;
  return -Math.min(20, diff * 5);
}

function pickBestCandidate(
  candidates,
  { title, year, titleGetter, dateGetter, popularityGetter = () => 0 }
) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  let best = null;

  for (const candidate of candidates) {
    const titleScore = scoreTitleMatch(title, titleGetter(candidate));
    if (titleScore < 20) continue;

    const yearScore = scoreYearMatch(year, dateGetter(candidate));
    const popularity = Number(popularityGetter(candidate)) || 0;
    const popularityScore = Math.min(10, Math.round(popularity / 1000));
    const totalScore = titleScore + yearScore + popularityScore;

    if (!best || totalScore > best.totalScore) {
      best = { candidate, totalScore, titleScore };
    }
  }

  if (!best) return null;
  if (best.titleScore < 40 && best.totalScore < 60) return null;
  return best.candidate;
}

function stripCacheMeta(record) {
  if (!record || typeof record !== "object") return {};
  const { cache_version, query_title_norm, query_year, query_type, ...rest } = record;
  return rest;
}

function mergeExternalWithLocalPriority(review, external) {
  const merged = { ...review, ...external };
  const localPriorityKeys = ["card_image", "poster_path", "official_description", "trailer_url"];
  for (const key of localPriorityKeys) {
    if (review[key]) {
      merged[key] = review[key];
    }
  }
  return merged;
}

async function fetchTMDBMovie(title, year) {
  if (!TMDB_API_KEY) {
    console.warn(`TMDB_API_KEY not set. Skipping TMDB data for \"${title}\"`);
    return null;
  }

  try {
    const query = encodeURIComponent(cleanSearchTitle(title));
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&year=${year}&include_adult=false&page=1`;
    const data = await fetchJsonWithRetry(url, {
      label: `TMDB movie search (${title})`,
      attempts: 4,
    });

    const movie = pickBestCandidate(data.results || [], {
      title,
      year,
      titleGetter: (item) => item.title,
      dateGetter: (item) => item.release_date,
      popularityGetter: (item) => item.vote_count,
    });

    if (!movie) {
      console.warn(`TMDB matching failed for \"${title}\"`);
      return null;
    }

    const result = {
      tmdb_id: movie.id,
      poster_path: movie.poster_path
        ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
        : null,
      card_image: movie.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${movie.backdrop_path}`
        : movie.poster_path
          ? `https://image.tmdb.org/t/p/w342${movie.poster_path}`
          : null,
      official_description: movie.overview,
      tmdb_rating: movie.vote_average,
      tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`,
    };

    const trailer = await fetchYouTubeApiTrailer(title, year, "movie");
    if (trailer) Object.assign(result, trailer);

    return result;
  } catch (err) {
    console.warn(`TMDB fetch error for \"${title}\":`, err.message);
    return null;
  }
}

async function fetchTMDBTVShow(title, year) {
  if (!TMDB_API_KEY) {
    console.warn(`TMDB_API_KEY not set. Skipping TMDB data for \"${title}\"`);
    return null;
  }

  try {
    const cleanTitle = cleanSearchTitle(title);
    const query = encodeURIComponent(cleanTitle);
    const url = `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${query}&include_adult=false&page=1`;
    const data = await fetchJsonWithRetry(url, {
      label: `TMDB TV search (${title})`,
      attempts: 4,
    });

    const show = pickBestCandidate(data.results || [], {
      title,
      year,
      titleGetter: (item) => item.name,
      dateGetter: (item) => item.first_air_date,
      popularityGetter: (item) => item.vote_count,
    });

    if (!show) {
      console.warn(`TMDB TV matching failed for \"${title}\"`);
      return null;
    }

    const result = {
      tmdb_id: show.id,
      poster_path: show.poster_path
        ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
        : null,
      card_image: show.backdrop_path
        ? `https://image.tmdb.org/t/p/w780${show.backdrop_path}`
        : show.poster_path
          ? `https://image.tmdb.org/t/p/w342${show.poster_path}`
          : null,
      official_description: show.overview,
      tmdb_rating: show.vote_average,
      tmdb_url: `https://www.themoviedb.org/tv/${show.id}`,
    };

    const trailer = await fetchYouTubeApiTrailer(title, year, "tv");
    if (trailer) Object.assign(result, trailer);

    return result;
  } catch (err) {
    console.warn(`TMDB fetch error for \"${title}\":`, err.message);
    return null;
  }
}

async function fetchRAWGGame(title, year) {
  if (!RAWG_API_KEY) {
    console.warn(`RAWG_API_KEY not set. Skipping RAWG data for \"${title}\"`);
    return null;
  }

  try {
    const query = encodeURIComponent(cleanSearchTitle(title));
    const url = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&search=${query}&search_precise=true&page_size=20`;
    const data = await fetchJsonWithRetry(url, {
      label: `RAWG search (${title})`,
      attempts: 4,
    });

    const canonicalCandidates = (data.results || []).filter(
      (item) => !isLikelySupplementalGameEntry(item)
    );

    const game = pickBestCandidate(canonicalCandidates, {
      title,
      year,
      titleGetter: (item) => item.name,
      dateGetter: (item) => item.released,
      popularityGetter: (item) => item.ratings_count || item.reviews_count,
    });

    if (!game) {
      console.warn(`RAWG matching failed for \"${title}\"`);
      return null;
    }

    const detailUrl = `https://api.rawg.io/api/games/${game.id}?key=${RAWG_API_KEY}`;
    const detail = await fetchJsonWithRetry(detailUrl, {
      label: `RAWG game detail (${title})`,
      attempts: 4,
    });

    const youtubeApiTrailer = await fetchYouTubeApiTrailer(title, year, "game");

    return {
      rawg_id: game.id,
      poster_path: detail?.background_image || game.background_image || null,
      card_image: detail?.background_image || game.background_image || null,
      official_description: detail?.description_raw || detail?.description || null,
      metacritic_score: detail?.metacritic || game.metacritic || null,
      rawg_url: game.slug ? `https://rawg.io/games/${game.slug}` : null,
      trailer_url: youtubeApiTrailer?.trailer_url || null,
      trailer_site: youtubeApiTrailer?.trailer_site || null,
      trailer_label: youtubeApiTrailer?.trailer_label || null,
    };
  } catch (err) {
    console.warn(`RAWG fetch error for \"${title}\":`, err.message);
    return null;
  }
}

async function enrichReview(review) {
  const cacheKey = `${review.slug}_${review.releaseYear}`;
  const normalizedTitle = normalizeTitle(review.title);
  const normalizedYear = Number(review.releaseYear);

  const cache = loadCache();
  const cached = cache[cacheKey];
  const validCachedRecord =
    cached &&
    cached.cache_version === CACHE_SCHEMA_VERSION &&
    cached.query_title_norm === normalizedTitle &&
    Number(cached.query_year) === normalizedYear &&
    cached.query_type === review.type;

  if (validCachedRecord && !REFRESH) {
    console.log(`Using cached data for \"${review.title}\"`);
    return mergeExternalWithLocalPriority(review, stripCacheMeta(cached));
  }

  if (cached && !REFRESH) {
    console.log(`Refreshing stale cache for \"${review.title}\"`);
  }

  console.log(`Fetching data for \"${review.title}\"...`);

  const external = {};

  if (review.type === "movie") {
    const tmdbData = await fetchTMDBMovie(review.title, review.releaseYear);
    if (tmdbData) Object.assign(external, tmdbData);
  } else if (review.type === "game") {
    const rawgData = await fetchRAWGGame(review.title, review.releaseYear);
    if (rawgData) Object.assign(external, rawgData);
  } else if (review.type === "tv") {
    const tmdbData = await fetchTMDBTVShow(review.title, review.releaseYear);
    if (tmdbData) Object.assign(external, tmdbData);
  }

  if (Object.keys(external).length > 0) {
    cache[cacheKey] = {
      ...external,
      cache_version: CACHE_SCHEMA_VERSION,
      query_title_norm: normalizedTitle,
      query_year: normalizedYear,
      query_type: review.type,
    };
    saveCache(cache);
    return mergeExternalWithLocalPriority(review, external);
  }

  if (cached && typeof cached === "object") {
    console.warn(`Using stale cache fallback for "${review.title}"`);
    return mergeExternalWithLocalPriority(review, stripCacheMeta(cached));
  }

  return mergeExternalWithLocalPriority(review, external);
}

async function enrichAllReviews(reviews) {
  const enriched = [];
  for (const review of reviews) {
    enriched.push(await enrichReview(review));
  }
  return enriched;
}

module.exports = {
  fetchTMDBMovie,
  fetchTMDBTVShow,
  fetchRAWGGame,
  enrichReview,
  enrichAllReviews,
};

