/**
 * Async data file: loads review files and enriches them with external API data.
 * This runs at build time and caches results locally.
 */

const fs = require("fs");
const path = require("path");
const { enrichAllReviews } = require("../_lib/external-data");
const { verdictFromRating, defaultAgeRating } = require("../_lib/review-utils");

const REVIEWS_DIR = path.join(__dirname, "reviews");
const LEGACY_FILE = path.join(__dirname, "_reviews-raw.json");

function loadReviewFiles() {
  if (!fs.existsSync(REVIEWS_DIR)) {
    return [];
  }

  const files = fs
    .readdirSync(REVIEWS_DIR)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort();

  const reviews = [];
  for (const file of files) {
    const fullPath = path.join(REVIEWS_DIR, file);
    try {
      const data = JSON.parse(fs.readFileSync(fullPath, "utf8"));
      reviews.push(data);
    } catch (err) {
      console.warn(`Skipping invalid review file "${file}":`, err.message);
    }
  }

  return reviews;
}

function hasRequiredFields(review) {
  const required = ["slug", "title", "type", "rating", "releaseYear"];
  return required.every((key) => review && review[key] !== undefined && review[key] !== null);
}

function applyRatingVerdictRule(review) {
  const trailerUrl = typeof review.trailer_url === "string" ? review.trailer_url.trim() : "";

  return {
    ...review,
    verdict: verdictFromRating(review.rating, review.type),
    ageRating: review.ageRating || defaultAgeRating(review.type),
    trailerUrl,
    trailerEmbedUrl: toYouTubeEmbedUrl(trailerUrl),
    trailerVideoUrl: toDirectVideoUrl(trailerUrl),
    trailerSearchUrl: buildTrailerSearchUrl(review),
  };
}

function buildTrailerSearchUrl(review) {
  const kind = review?.type === "game" ? "game trailer" : "official trailer";
  const query = [review?.title, review?.releaseYear, kind].filter(Boolean).join(" ");
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
}

function toDirectVideoUrl(url) {
  if (typeof url !== "string" || !url) return "";
  if (!/^https?:\/\//i.test(url)) return "";
  const noQuery = url.split("?")[0].toLowerCase();
  if (noQuery.endsWith(".mp4") || noQuery.endsWith(".webm") || noQuery.endsWith(".ogg")) {
    return url;
  }
  return "";
}

function toYouTubeEmbedUrl(url) {
  if (typeof url !== "string" || !url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    let videoId = "";

    if (host === "youtu.be") {
      videoId = parsed.pathname.slice(1);
    } else if (host.endsWith("youtube.com")) {
      if (parsed.pathname === "/watch") {
        videoId = parsed.searchParams.get("v") || "";
      } else if (parsed.pathname.startsWith("/embed/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      } else if (parsed.pathname.startsWith("/shorts/")) {
        videoId = parsed.pathname.split("/")[2] || "";
      }
    }

    if (!videoId) return "";
    return `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
  } catch (_err) {
    return "";
  }
}

function sortByReviewDateDesc(reviews) {
  return [...reviews].sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate));
}

function loadReviewsRaw() {
  const fromFiles = loadReviewFiles().filter(hasRequiredFields);
  if (fromFiles.length > 0) {
    return sortByReviewDateDesc(fromFiles.map(applyRatingVerdictRule));
  }

  console.warn("No valid files found in _data/reviews; falling back to _reviews-raw.json");
  const legacy = JSON.parse(fs.readFileSync(LEGACY_FILE, "utf8"));
  return sortByReviewDateDesc(legacy.filter(hasRequiredFields).map(applyRatingVerdictRule));
}

module.exports = async function () {
  console.log("\nLoading and enriching reviews...\n");
  const reviewsRaw = loadReviewsRaw();

  try {
    const enriched = await enrichAllReviews(reviewsRaw);
    console.log("\nReviews enriched with external data\n");
    return sortByReviewDateDesc(enriched.map(applyRatingVerdictRule));
  } catch (err) {
    console.warn("Error enriching reviews, using raw data:", err.message);
    return sortByReviewDateDesc(reviewsRaw.map(applyRatingVerdictRule));
  }
};
