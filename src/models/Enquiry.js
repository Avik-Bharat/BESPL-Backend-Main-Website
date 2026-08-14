"use strict";

const mongoose = require("mongoose");

const EMAIL_PATTERN = /^\S+@\S+\.\S+$/;

const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, match: EMAIL_PATTERN },
    phone: { type: String, trim: true, maxlength: 20 },
    service: { type: String, trim: true, maxlength: 120 },
    message: { type: String, trim: true, maxlength: 2000 },
    source: { type: String, default: "website-contact-form" },
    status: { type: String, enum: ["new", "contacted", "closed"], default: "new" },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);

// Sales works the list newest-first and filters by status.
enquirySchema.index({ createdAt: -1 });
enquirySchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model("Enquiry", enquirySchema);
