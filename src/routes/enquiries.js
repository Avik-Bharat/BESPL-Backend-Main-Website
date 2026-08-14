"use strict";

const express = require("express");
const mongoose = require("mongoose");

const Enquiry = require("../models/Enquiry");
const { validateEnquiry, isHoneypotFilled } = require("../middleware/validate");
const { createSubmissionLimiter } = require("../middleware/rateLimit");
const { requestMeta } = require("../lib/requestMeta");
const { sendEnquiryEmails } = require("../services/mailer");

const router = express.Router();

/**
 * POST /api/v1/enquiries
 * Public. Stores a contact-form enquiry and notifies sales.
 */
router.post("/", createSubmissionLimiter(), async (req, res, next) => {
  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    // Bot caught by the honeypot: look successful, persist nothing.
    if (isHoneypotFilled(body)) {
      return res.status(201).json({
        success: true,
        data: { id: new mongoose.Types.ObjectId().toString(), createdAt: new Date().toISOString() }
      });
    }

    const values = validateEnquiry(body);
    const enquiry = await Enquiry.create({ ...values, ...requestMeta(req) });

    res.status(201).json({
      success: true,
      data: { id: enquiry._id.toString(), createdAt: enquiry.createdAt.toISOString() }
    });

    // Email is a side effect: it must never delay or fail the visitor's response.
    setImmediate(() => {
      sendEnquiryEmails(enquiry).catch((err) => console.error("[mail] enquiry emails failed:", err.message));
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
