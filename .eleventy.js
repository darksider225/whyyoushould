module.exports = function(eleventyConfig) {
  // Load environment variables
  require("dotenv").config();
  const configuredPathPrefix = process.env.ELEVENTY_PATH_PREFIX || "/";

  const fs = require("fs");
  const path = require("path");

  const CACHE_SCHEMA_VERSION = 5;
  const cacheFile = path.join(__dirname, "_data", ".cache", "external-data.json");
  const reviewsDir = path.join(__dirname, "_data", "reviews");
  const legacyFile = path.join(__dirname, "_data", "_reviews-raw.json");

  let apiCache = {};

  if (fs.existsSync(cacheFile)) {
    try {
      apiCache = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
    } catch (e) {
      console.warn("Could not load API cache");
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

  function stripCacheMeta(record) {
    if (!record || typeof record !== "object") return {};
    const { cache_version, query_title_norm, query_year, query_type, ...data } = record;
    return data;
  }

  function verdictFromRating(rating) {
    const score = Number(rating);
    if (!Number.isFinite(score)) return "Average";
    if (score > 8.4 && score <= 10) return "Must Watch";
    if (score > 6.9) return "Worth Your Time";
    if (score > 5.5) return "Average";
    return "Skip";
  }

  function hasRequiredFields(review) {
    const required = ["slug", "title", "type", "rating", "releaseYear"];
    return required.every((key) => review && review[key] !== undefined && review[key] !== null);
  }

  function loadReviewsRaw() {
    let fromFiles = [];

    if (fs.existsSync(reviewsDir)) {
      const files = fs
        .readdirSync(reviewsDir)
        .filter((file) => file.toLowerCase().endsWith(".json"))
        .sort();

      fromFiles = files
        .map((file) => {
          const fullPath = path.join(reviewsDir, file);
          try {
            return JSON.parse(fs.readFileSync(fullPath, "utf8"));
          } catch (err) {
            console.warn(`Skipping invalid review file "${file}":`, err.message);
            return null;
          }
        })
        .filter(Boolean)
        .filter(hasRequiredFields);
    }

    if (fromFiles.length > 0) {
      return fromFiles;
    }

    console.warn("No valid files found in _data/reviews; falling back to _reviews-raw.json");
    if (!fs.existsSync(legacyFile)) {
      return [];
    }

    try {
      const legacy = JSON.parse(fs.readFileSync(legacyFile, "utf8"));
      return Array.isArray(legacy) ? legacy.filter(hasRequiredFields) : [];
    } catch (err) {
      console.warn("Failed to load _reviews-raw.json:", err.message);
      return [];
    }
  }

  // Helper function to merge review data with valid API cache
  function enrichReview(review) {
    const cacheKey = `${review.slug}_${review.releaseYear}`;
    const cached = apiCache[cacheKey];
    const normalized = normalizeTitle(review.title);
    const isValid =
      cached &&
      cached.cache_version === CACHE_SCHEMA_VERSION &&
      cached.query_title_norm === normalized &&
      Number(cached.query_year) === Number(review.releaseYear) &&
      cached.query_type === review.type;

    const merged = isValid ? { ...review, ...stripCacheMeta(cached) } : review;
    return { ...merged, verdict: verdictFromRating(merged.rating) };
  }

  function sortByReviewDateDesc(items) {
    return [...items].sort((a, b) => new Date(b.reviewDate) - new Date(a.reviewDate));
  }

  function getEnrichedReviews() {
    return sortByReviewDateDesc(loadReviewsRaw().map(enrichReview));
  }

  // Passthrough copies
  eleventyConfig.addPassthroughCopy("css");
  eleventyConfig.addPassthroughCopy("images");
  eleventyConfig.addPassthroughCopy("js");

  eleventyConfig.addCollection("reviewsData", function() {
    return getEnrichedReviews();
  });

  eleventyConfig.addCollection("movies", function() {
    return getEnrichedReviews().filter((item) => item.type === "movie");
  });

  eleventyConfig.addCollection("games", function() {
    return getEnrichedReviews().filter((item) => item.type === "game");
  });

  eleventyConfig.addCollection("tvshows", function() {
    return getEnrichedReviews().filter((item) => item.type === "tv");
  });

  // Filters
  eleventyConfig.addFilter("readableDate", (dateObj) => {
    return new Date(dateObj).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  });

  eleventyConfig.addFilter("verdictClass", (verdict) => {
    if (verdict === "Must Watch") return "must";
    if (verdict === "Worth Your Time") return "worth";
    if (verdict === "Average") return "average";
    if (verdict === "Skip") return "skip";
    return "";
  });

  return {
    pathPrefix: configuredPathPrefix,
    dir: {
      input: ".",
      includes: "_includes",
      output: "_site",
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
  };
};
