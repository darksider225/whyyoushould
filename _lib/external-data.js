/**
 * External API integration for TMDB and RAWG.
 * Fetches metadata and caches results locally.
 */

const fs = require("fs");
const path = require("path");

require("dotenv").config();

const TMDB_API_KEY = process.env.TMDB_API_KEY;
const RAWG_API_KEY = process.env.RAWG_API_KEY;
const REFRESH = process.env.REFRESH_EXTERNAL_DATA === "true";
const CACHE_SCHEMA_VERSION = 5;

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

async function fetchTMDBMovie(title, year) {
  if (!TMDB_API_KEY) {
    console.warn(`TMDB_API_KEY not set. Skipping TMDB data for \"${title}\"`);
    return null;
  }

  try {
    const query = encodeURIComponent(cleanSearchTitle(title));
    const url = `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${query}&year=${year}&include_adult=false&page=1`;

    const response = await fetch(url);
    const data = await response.json();

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

    return {
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

    const response = await fetch(url);
    const data = await response.json();

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

    return {
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

    const response = await fetch(url);
    const data = await response.json();

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

    return {
      rawg_id: game.id,
      poster_path: game.background_image || null,
      card_image: game.background_image || null,
      official_description: game.description || null,
      metacritic_score: game.metacritic || null,
      rawg_url: game.slug ? `https://rawg.io/games/${game.slug}` : null,
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
    return { ...review, ...stripCacheMeta(cached) };
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
    return { ...review, ...external };
  }

  if (cached && typeof cached === "object") {
    console.warn(`Using stale cache fallback for "${review.title}"`);
    return { ...review, ...stripCacheMeta(cached) };
  }

  return { ...review, ...external };
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

