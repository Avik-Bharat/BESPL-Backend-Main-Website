"use strict";

const { cleanString } = require("../middleware/validate");

/**
 * `req.ip` already honours the configured `trust proxy` setting, so it is the
 * real client IP behind one reverse proxy and cannot be spoofed beyond it.
 * Both values are logged per the spec's abuse-review requirement.
 */
function requestMeta(req) {
  return {
    ip: req.ip || req.socket?.remoteAddress || "",
    userAgent: cleanString(req.get("user-agent")).slice(0, 512)
  };
}

module.exports = { requestMeta };
