"use strict";

const mongoose = require("mongoose");
const { BROCHURE_KEYS } = require("../lib/brochures");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const brochureRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, match: EMAIL_PATTERN },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    brochure: { type: String, required: true, enum: BROCHURE_KEYS },
    message: { type: String, trim: true, maxlength: 2000 },
    source: { type: String, default: "website-brochure-modal" },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

brochureRequestSchema.index({ createdAt: -1 });
brochureRequestSchema.index({ brochure: 1, createdAt: -1 });

module.exports = mongoose.model("BrochureRequest", brochureRequestSchema);
