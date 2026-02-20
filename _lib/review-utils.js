"use strict";

function verdictFromRating(rating, type) {
  const score = Number(rating);
  if (!Number.isFinite(score)) return "Average";
  if (score > 8.4 && score <= 10) return type === "game" ? "Must Play" : "Must Watch";
  if (score > 6.9) return "Worth Your Time";
  if (score > 5.5) return "Average";
  return "Skip";
}

function defaultAgeRating(_type) {
  return "13+";
}

function toSlug(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

function countWords(text) {
  if (!text) return 0;
  return String(text)
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}

function isIsoDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isSafeImagePath(value) {
  if (!value) return true;
  if (typeof value !== "string") return false;
  return /^https?:\/\//.test(value) || value.startsWith("/");
}

module.exports = {
  verdictFromRating,
  defaultAgeRating,
  toSlug,
  countWords,
  isIsoDate,
  isSafeImagePath,
};
