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
  return {
    ...review,
    verdict: verdictFromRating(review.rating, review.type),
    ageRating: review.ageRating || defaultAgeRating(review.type),
  };
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
    return enriched;
  } catch (err) {
    console.warn("Error enriching reviews, using raw data:", err.message);
    return reviewsRaw;
  }
};
