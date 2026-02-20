"use strict";

const fs = require("fs");
const path = require("path");
const { defaultAgeRating, toSlug, verdictFromRating } = require("../_lib/review-utils");
const { REVIEWS_DIR } = require("./review-file-utils");

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

function usage() {
  console.log(
    "Usage: npm run review:new -- --type <movie|tv|game> --title \"Title\" [--year 2026] [--rating 7.5] [--slug custom-slug]"
  );
}

function buildTemplate({ type, title, year, rating, slug }) {
  const now = new Date().toISOString().slice(0, 10);
  const base = {
    schemaVersion: 1,
    slug,
    title,
    type,
    verdict: verdictFromRating(rating, type),
    why: "One-sentence reason this is worth (or not worth) your time.",
    rating,
    releaseYear: year,
    ageRating: defaultAgeRating(type),
    genre: ["Genre 1", "Genre 2"],
    creator: "Creator / Studio",
    platform: ["Platform 1"],
    reviewDate: now,
    timeInvestment: "Runtime or expected hours",
    moodTags: ["tag1", "tag2", "tag3"],
    excerpt: "One-line highlight.",
    similarTitles: ["Title A", "Title B", "Title C"],
    content: "One-paragraph review summary.",
    hook: "",
    ratingsSnapshot: [],
    ratingsSummary: "",
    criticsVoice: "",
    audienceVoice: "",
    miniAnecdote: "",
    practicalTips: "",
    finalNudge: "",
  };

  if (type === "game") {
    base.playGist = "";
    base.whatStoodOut = [
      { label: "World Design", text: "" },
      { label: "Combat", text: "" },
      { label: "Freedom", text: "" },
    ];
    base.whyYouShouldPlay = ["", "", "", "", ""];
    base.ratingsSnapshot = [
      { label: "Metacritic", value: "" },
      { label: "IGN", value: "" },
      { label: "GameSpot", value: "" },
      { label: "Steam Reviews", value: "" },
    ];
  } else {
    base.quickGist = "";
    base.whatHitMe = [
      { label: type === "tv" ? "Characters" : "Visuals", text: "" },
      { label: type === "tv" ? "Writing" : "Score", text: "" },
      { label: type === "tv" ? "Episodes" : "Emotion", text: "" },
    ];
    base.whyYouShouldWatch = ["", "", "", "", ""];
    base.ratingsSnapshot = [
      { label: "IMDb", value: "" },
      { label: "Rotten Tomatoes", value: "" },
      { label: "Metacritic", value: "" },
    ];
  }

  return base;
}

function main() {
  const args = parseArgs(process.argv);
  const type = String(args.type || "").toLowerCase();
  const title = String(args.title || "").trim();
  const year = Number(args.year || new Date().getFullYear());
  const rating = Number(args.rating || 7.5);
  const slug = String(args.slug || toSlug(title));

  if (!["movie", "tv", "game"].includes(type) || !title || !slug || !Number.isFinite(year)) {
    usage();
    process.exit(1);
  }

  if (!fs.existsSync(REVIEWS_DIR)) {
    fs.mkdirSync(REVIEWS_DIR, { recursive: true });
  }

  const outputPath = path.join(REVIEWS_DIR, `${slug}.json`);
  if (fs.existsSync(outputPath)) {
    console.error(`File already exists: ${outputPath}`);
    process.exit(1);
  }

  const payload = buildTemplate({ type, title, year, rating, slug });
  fs.writeFileSync(outputPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  console.log(`Created review scaffold: ${outputPath}`);
}

main();
