"use strict";

const fs = require("fs");
const path = require("path");

const REVIEWS_DIR = path.join(__dirname, "..", "_data", "reviews");

function listReviewFiles() {
  if (!fs.existsSync(REVIEWS_DIR)) return [];
  return fs
    .readdirSync(REVIEWS_DIR)
    .filter((file) => file.toLowerCase().endsWith(".json"))
    .sort()
    .map((file) => path.join(REVIEWS_DIR, file));
}

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function loadReviews() {
  const files = listReviewFiles();
  return files.map((filePath) => ({
    filePath,
    filename: path.basename(filePath),
    data: readJson(filePath),
  }));
}

module.exports = {
  REVIEWS_DIR,
  listReviewFiles,
  readJson,
  loadReviews,
};
