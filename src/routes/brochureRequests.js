"use strict";

const express = require("express");
const mongoose = require("mongoose");

const BrochureRequest = require("../models/BrochureRequest");
const { validateBrochureRequest, isHoneypotFilled } = require("../middleware/validate");
const { createSubmissionLimiter } = require("../middleware/rateLimit");
const { requestMeta } = require("../lib/requestMeta");
const { BROCHURES, brochureUrl } = require("../lib/brochures");
const { sendBrochureEmails } = require("../services/mailer");

const router = express.Router();

/**
 * GET /api/v1/brochure-requests/options
 * Convenience endpoint so the frontend dropdown can be sourced from the API
 * instead of a hard-coded copy of the enum.
 */
router.get("/options", (req, res) => {
  res.json({
    success: true,
    data: BROCHURES.map(({ key, label }) => ({ key, label, url: brochureUrl(key) }))
  });
});

/**
 * POST /api/v1/brochure-requests
 * Public. Captures the lead behind the brochure download. The PDF itself is
 * served statically by the frontend; `brochureUrl` is returned so the path has
 * a single source of truth.
 */
router.post("/", createSubmissionLimiter(), async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (isHoneypotFilled(body)) {
      const brochure = typeof body.brochure === "string" ? body.brochure : BROCHURES[0].key;
      return res.status(201).json({
        success: true,
        data: {
          id: new mongoose.Types.ObjectId().toString(),
          brochure,
          brochureUrl: brochureUrl(brochure) || brochureUrl(BROCHURES[0].key),
          createdAt: new Date().toISOString()
        }
      });
    }

    const values = validateBrochureRequest(body);
    const request = await BrochureRequest.create({ ...values, ...requestMeta(req) });

    res.status(201).json({
      success: true,
      data: {
        id: request._id.toString(),
        brochure: request.brochure,
        brochureUrl: brochureUrl(request.brochure),
        createdAt: request.createdAt.toISOString()
      }
    });

    setImmediate(() => {
      sendBrochureEmails(request).catch((err) => console.error("[mail] brochure emails failed:", err.message));
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
