"use strict";

const path = require("path");
const { env } = require("../config/env");

/**
 * Single source of truth for the brochure enum. Must stay identical to
 * `BROCHURES` in the frontend's `lib/data.ts` so the enum values never drift.
 */
const BROCHURES = [
  { key: "fire-safety", label: "Fire and Safety", file: "BESPL- FIRE PPT.pdf" },
  { key: "water-waste-treatment", label: "Water and Waste Water Treatment Solution", file: "BESPL- WATER PPT.pdf" },
  { key: "solar-power-plants", label: "Solar Power Plants", file: "BESPL- SOLAR PPT.pdf" }
];

const BROCHURE_KEYS = BROCHURES.map((b) => b.key);

const BY_KEY = new Map(BROCHURES.map((b) => [b.key, b]));

function getBrochure(key) {
  return BY_KEY.get(key) || null;
}

/** Public path the frontend serves the PDF from (`public/brochures/*`). */
function brochureUrl(key) {
  const brochure = getBrochure(key);
  return brochure ? `/brochures/${brochure.file}` : null;
}

/** Absolute path to the local PDF copy, used for email attachments. */
function brochureFilePath(key) {
  const brochure = getBrochure(key);
  return brochure ? path.join(env.brochureDir, brochure.file) : null;
}

module.exports = { BROCHURES, BROCHURE_KEYS, getBrochure, brochureUrl, brochureFilePath };
