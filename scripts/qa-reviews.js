"use strict";

const { countWords } = require("../_lib/review-utils");
const { loadReviews } = require("./review-file-utils");

const WARN_TOTAL_WORD_MIN = 1100;
const WARN_TOTAL_WORD_MAX = 1500;

function getNarrativeText(data) {
  const fields = [
    data.hook,
    data.quickGist,
    data.playGist,
    ...(Array.isArray(data.whatHitMe) ? data.whatHitMe.map((x) => x && x.text) : []),
    ...(Array.isArray(data.whatStandsOut) ? data.whatStandsOut.map((x) => x && x.text) : []),
    ...(Array.isArray(data.whatStoodOut) ? data.whatStoodOut.map((x) => x && x.text) : []),
    data.ratingsSummary,
    data.criticsVoice,
    data.audienceVoice,
    ...(Array.isArray(data.whyYouShouldWatch) ? data.whyYouShouldWatch : []),
    ...(Array.isArray(data.whyYouShouldPlay) ? data.whyYouShouldPlay : []),
    data.miniAnecdote,
    data.practicalTips,
    data.finalNudge,
    data.content,
  ];
  return fields.filter(Boolean).join(" ");
}

function hasAnySection(data, keys) {
  return keys.some((k) => {
    const value = data[k];
    if (Array.isArray(value)) return value.length > 0;
    return !!value;
  });
}

function main() {
  const warnings = [];
  const errors = [];
  const entries = loadReviews();

  entries.forEach(({ filename, data }) => {
    const where = `[${filename}]`;
    const totalWords = countWords(getNarrativeText(data));

    if (totalWords < WARN_TOTAL_WORD_MIN || totalWords > WARN_TOTAL_WORD_MAX) {
      warnings.push(
        `${where} narrative word count ${totalWords} (expected ${WARN_TOTAL_WORD_MIN}-${WARN_TOTAL_WORD_MAX})`
      );
    }

    if (!hasAnySection(data, ["hook"])) {
      errors.push(`${where} missing section: hook`);
    }
    if (!hasAnySection(data, ["quickGist", "playGist"])) {
      errors.push(`${where} missing section: quickGist/playGist`);
    }
    if (!hasAnySection(data, ["whatHitMe", "whatStandsOut", "whatStoodOut"])) {
      errors.push(`${where} missing section: whatHitMe/whatStandsOut`);
    }
    if (!hasAnySection(data, ["criticsVoice"])) {
      errors.push(`${where} missing section: criticsVoice`);
    }
    if (!hasAnySection(data, ["audienceVoice"])) {
      errors.push(`${where} missing section: audienceVoice`);
    }
    if (!hasAnySection(data, ["finalNudge"])) {
      errors.push(`${where} missing section: finalNudge`);
    }
  });

  console.log(`QA checked ${entries.length} review file(s).`);

  if (warnings.length > 0) {
    console.warn("\nWarnings:");
    warnings.forEach((item) => console.warn(`- ${item}`));
  }

  if (errors.length > 0) {
    console.error("\nQA failed:");
    errors.forEach((item) => console.error(`- ${item}`));
    process.exit(1);
  }

  console.log("QA passed.");
}

main();
