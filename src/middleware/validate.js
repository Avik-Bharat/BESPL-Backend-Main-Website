"use strict";

const ApiError = require("../lib/ApiError");
const { BROCHURE_KEYS } = require("../lib/brochures");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-().\s]{6,20}$/;

// Control characters, keeping tab / LF / CR. Dropping these guards against
// header and log injection, and against invisible junk in the stored lead.
const CONTROL_CHARS = /[^\P{C}\n\r\t]/gu;

function cleanString(value) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value);
  if (typeof value !== "string") return "";
  return value.replace(CONTROL_CHARS, "").trim();
}

/**
 * For fields that end up in an email subject or a single-line label. Line
 * breaks are folded into spaces so a submitted value can never introduce a
 * header of its own.
 */
function cleanLine(value) {
  return cleanString(value).replace(/\s+/g, " ").trim();
}

/**
 * Collects field-level errors and turns them into the single human-readable
 * `message` the frontend shows. Wording matches the API spec examples.
 */
class FieldErrors {
  constructor() {
    this.fields = {};
    this.missing = [];
  }

  add(field, reason, { missing = false } = {}) {
    if (this.fields[field]) return; // keep the first (most specific) reason
    this.fields[field] = reason;
    if (missing) this.missing.push(field);
  }

  get hasErrors() {
    return Object.keys(this.fields).length > 0;
  }

  message() {
    const keys = Object.keys(this.fields);
    if (this.missing.includes("name") && this.missing.includes("email")) {
      return "Name and email are required.";
    }
    if (keys.length === 1 && keys[0] === "brochure") {
      return "Select a brochure to continue.";
    }
    return this.fields[keys[0]];
  }

  toError() {
    return ApiError.validation(this.message(), this.fields);
  }
}

function checkName(raw, errors) {
  const name = cleanLine(raw);
  if (!name) {
    errors.add("name", "Enter your name.", { missing: true });
  } else if (name.length < 2) {
    errors.add("name", "Name must be at least 2 characters.");
  } else if (name.length > 120) {
    errors.add("name", "Name must be 120 characters or fewer.");
  }
  return name;
}

function checkEmail(raw, errors) {
  const email = cleanLine(raw).toLowerCase();
  if (!email) {
    errors.add("email", "Enter your email address.", { missing: true });
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.add("email", "Enter a valid email address.");
  }
  return email;
}

function checkPhone(raw, errors, { required }) {
  const phone = cleanLine(raw);
  if (!phone) {
    if (required) errors.add("phone", "Enter your phone number.", { missing: true });
    return "";
  }
  if (!PHONE_PATTERN.test(phone)) {
    errors.add("phone", "Enter a valid phone number (6-20 characters).");
  }
  return phone;
}

function checkOptionalText(raw, errors, { field, max, label, singleLine = false }) {
  const text = singleLine ? cleanLine(raw) : cleanString(raw);
  if (text.length > max) {
    errors.add(field, `${label} must be ${max} characters or fewer.`);
  }
  return text;
}

function checkBrochure(raw, errors) {
  const brochure = cleanLine(raw);
  const reason = `Must be one of ${BROCHURE_KEYS.join(", ")}.`;
  if (!brochure) {
    errors.add("brochure", reason, { missing: true });
  } else if (!BROCHURE_KEYS.includes(brochure)) {
    errors.add("brochure", reason);
  }
  return brochure;
}

/**
 * Honeypot: the frontend never renders a `company` input, so a filled one means
 * a bot. The spec asks us to silently succeed without persisting.
 */
function isHoneypotFilled(body) {
  return cleanString(body.company).length > 0;
}

function validateEnquiry(body) {
  const errors = new FieldErrors();
  const values = {
    name: checkName(body.name, errors),
    email: checkEmail(body.email, errors),
    phone: checkPhone(body.phone, errors, { required: false }),
    service: checkOptionalText(body.service, errors, { field: "service", max: 120, label: "Service", singleLine: true }),
    message: checkOptionalText(body.message, errors, { field: "message", max: 2000, label: "Message" })
  };
  if (errors.hasErrors) throw errors.toError();
  return values;
}

function validateBrochureRequest(body) {
  const errors = new FieldErrors();
  const values = {
    name: checkName(body.name, errors),
    email: checkEmail(body.email, errors),
    phone: checkPhone(body.phone, errors, { required: true }),
    brochure: checkBrochure(body.brochure, errors),
    message: checkOptionalText(body.message, errors, { field: "message", max: 2000, label: "Message" })
  };
  if (errors.hasErrors) throw errors.toError();
  return values;
}

module.exports = { validateEnquiry, validateBrochureRequest, isHoneypotFilled, cleanString, cleanLine };
