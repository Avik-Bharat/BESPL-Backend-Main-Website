"use strict";

const rateLimit = require("express-rate-limit");
const { env } = require("../config/env");

const RATE_LIMIT_BODY = {
  success: false,
  error: {
    code: "RATE_LIMITED",
    message: "Too many requests. Please wait a few minutes and try again."
  }
};

/**
 * Both public endpoints get their own limiter instance, so hitting the
 * brochure form does not eat the contact form's allowance.
 * Default: 5 requests / 10 minutes / IP / endpoint.
 */
function createSubmissionLimiter() {
  return rateLimit({
    windowMs: env.rateLimit.windowMs,
    limit: env.rateLimit.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    // Preflight requests never reach the handler, so don't spend the budget.
    skip: (req) => req.method === "OPTIONS",
    handler: (req, res) => res.status(429).json(RATE_LIMIT_BODY)
  });
}

module.exports = { createSubmissionLimiter };
