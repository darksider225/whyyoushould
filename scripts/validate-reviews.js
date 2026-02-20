"use strict";

const path = require("path");
const {
  verdictFromRating,
  isIsoDate,
  isSafeImagePath,
} = require("../_lib/review-utils");
const { loadReviews } = require("./review-file-utils");

const VALID_TYPES = new Set(["movie", "tv", "game"]);
const REQUIRED_KEYS = [
  "slug",
  "title",
  "type",
  "verdict",
  "why",
  "rating",
  "releaseYear",
  "creator",
  "platform",
  "reviewDate",
  "timeInvestment",
  "content",
];

function fail(msg, issues) {
  issues.push(msg);
}

function warn(msg, warnings) {
  warnings.push(msg);
}

function validateReview(entry, issues, warnings, slugSet, titleSet) {
  const { data, filename } = entry;
  const where = `[${filename}]`;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    fail(`${where} must be a JSON object`, issues);
    return;
  }

  for (const key of REQUIRED_KEYS) {
    if (data[key] === undefined || data[key] === null || data[key] === "") {
      fail(`${where} missing required field: ${key}`, issues);
    }
  }

  if (typeof data.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(data.slug || "")) {
    fail(`${where} slug must be kebab-case (lowercase letters/numbers/hyphen)`, issues);
  }

  const expectedFilename = `${data.slug}.json`;
  if (data.slug && expectedFilename !== filename) {
    warn(`${where} filename does not match slug (expected ${expectedFilename})`, warnings);
  }

  if (!VALID_TYPES.has(data.type)) {
    fail(`${where} type must be one of: movie, tv, game`, issues);
  }

  const rating = Number(data.rating);
  if (!Number.isFinite(rating) || rating < 0 || rating > 10) {
    fail(`${where} rating must be a number between 0 and 10`, issues);
  } else {
    const expectedVerdict = verdictFromRating(rating, data.type);
    if (data.verdict !== expectedVerdict) {
      fail(`${where} verdict mismatch: expected "${expectedVerdict}" from rating ${rating}`, issues);
    }
  }

  if (!Number.isInteger(Number(data.releaseYear))) {
    fail(`${where} releaseYear must be an integer year`, issues);
  }

  if (!isIsoDate(data.reviewDate)) {
    fail(`${where} reviewDate must be YYYY-MM-DD`, issues);
  }

  if (!Array.isArray(data.platform) || data.platform.length === 0) {
    fail(`${where} platform must be a non-empty array`, issues);
  }

  if (data.genre && (!Array.isArray(data.genre) || data.genre.length === 0)) {
    fail(`${where} genre must be an array when provided`, issues);
  }

  if (data.moodTags && (!Array.isArray(data.moodTags) || data.moodTags.length === 0)) {
    fail(`${where} moodTags must be an array when provided`, issues);
  }

  if (data.similarTitles && (!Array.isArray(data.similarTitles) || data.similarTitles.length === 0)) {
    fail(`${where} similarTitles must be an array when provided`, issues);
  }

  if (data.card_image && !isSafeImagePath(data.card_image)) {
    fail(`${where} card_image must be absolute http(s) URL or root-relative path`, issues);
  }

  if (data.poster_path && !isSafeImagePath(data.poster_path)) {
    fail(`${where} poster_path must be absolute http(s) URL or root-relative path`, issues);
  }

  if (data.ageRating && typeof data.ageRating !== "string") {
    fail(`${where} ageRating must be a string when provided`, issues);
  }

  const slugKey = String(data.slug || "").toLowerCase();
  if (slugKey) {
    if (slugSet.has(slugKey)) {
      fail(`${where} duplicate slug found: ${data.slug}`, issues);
    }
    slugSet.add(slugKey);
  }

  const titleKey = String(data.title || "").trim().toLowerCase();
  if (titleKey) {
    if (titleSet.has(titleKey)) {
      fail(`${where} duplicate title found: ${data.title}`, issues);
    }
    titleSet.add(titleKey);
  }
}

function main() {
  const issues = [];
  const warnings = [];
  const slugSet = new Set();
  const titleSet = new Set();

  let entries;
  try {
    entries = loadReviews();
  } catch (error) {
    console.error(`Failed to parse review files: ${error.message}`);
    process.exit(1);
  }

  if (entries.length === 0) {
    console.error("No review files found in _data/reviews");
    process.exit(1);
  }

  entries.forEach((entry) => validateReview(entry, issues, warnings, slugSet, titleSet));

  if (warnings.length > 0) {
    console.warn("\nValidation warnings:");
    warnings.forEach((item) => console.warn(`- ${item}`));
  }

  if (issues.length > 0) {
    console.error("\nReview validation failed:\n");
    issues.forEach((issue) => console.error(`- ${issue}`));
    console.error(`\n${issues.length} issue(s) found.`);
    process.exit(1);
  }

  console.log(`Validated ${entries.length} review file(s) successfully.`);
}

main();
