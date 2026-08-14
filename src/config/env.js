"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

/** Reads a comma-separated env var into a trimmed, de-duplicated array. */
function list(name) {
  return [
    ...new Set(
      String(process.env[name] || "")
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean)
    )
  ];
}

function bool(name, fallback = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  return ["1", "true", "yes", "on"].includes(String(raw).trim().toLowerCase());
}

function int(name, fallback) {
  const parsed = Number.parseInt(process.env[name], 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * `trust proxy` must match the hosting setup. Behind exactly one proxy
 * (Render, Railway, Nginx, Cloudflare -> origin) `1` is correct. Setting it to
 * `true` would let anyone spoof X-Forwarded-For and bypass the IP rate limit.
 */
function trustProxy() {
  const raw = String(process.env.TRUST_PROXY ?? "1").trim();
  if (raw === "" || raw.toLowerCase() === "false") return false;
  if (/^\d+$/.test(raw)) return Number.parseInt(raw, 10);
  return raw; // e.g. "loopback" or a subnet
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction: (process.env.NODE_ENV || "development") === "production",
  port: int("PORT", 5000),
  mongoUri: process.env.MONGODB_URI || "",
  allowedOrigins: list("ALLOWED_ORIGINS"),
  trustProxy: trustProxy(),

  rateLimit: {
    windowMs: int("RATE_LIMIT_WINDOW_MS", 10 * 60 * 1000), // 10 minutes
    max: int("RATE_LIMIT_MAX", 5) // per IP, per endpoint
  },

  mail: {
    host: process.env.SMTP_HOST || "",
    port: int("SMTP_PORT", 465),
    secure: bool("SMTP_SECURE", int("SMTP_PORT", 465) === 465),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    from: process.env.MAIL_FROM || "",
    salesRecipients: list("SALES_RECIPIENTS"),
    autoReply: bool("AUTO_REPLY_ENABLED", true),
    attachBrochure: bool("BROCHURE_ATTACH_ENABLED", true)
  },

  brochureDir: process.env.BROCHURE_DIR
    ? path.resolve(process.env.BROCHURE_DIR)
    : path.resolve(__dirname, "../../brochures")
};

/** Fails fast on missing config instead of surfacing it as a runtime 500. */
function assertRequiredEnv() {
  const missing = [];
  if (!env.mongoUri) missing.push("MONGODB_URI");
  if (env.isProduction && env.allowedOrigins.length === 0) missing.push("ALLOWED_ORIGINS");

  if (missing.length) {
    throw new Error(`Missing required environment variable(s): ${missing.join(", ")}`);
  }
}

module.exports = { env, assertRequiredEnv };
