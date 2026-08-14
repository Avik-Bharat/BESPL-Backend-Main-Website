"use strict";

const ApiError = require("../lib/ApiError");
const { env } = require("../config/env");

function notFoundHandler(req, res, next) {
  next(ApiError.notFound(`No route for ${req.method} ${req.originalUrl}`));
}

/**
 * Single place that turns anything thrown in the stack into the shared error
 * envelope. Internal details are never leaked to the client in production.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err instanceof ApiError) {
    if (err.status >= 500) console.error("[error]", err);
    return res.status(err.status).json(err.toBody());
  }

  // Malformed JSON body -> express.json() throws a SyntaxError with `.body`.
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json(ApiError.validation("Request body must be valid JSON.").toBody());
  }

  // Payload larger than the configured body limit.
  if (err.type === "entity.too.large") {
    return res.status(413).json(ApiError.validation("Request body is too large.").toBody());
  }

  /**
   * The request validator should catch everything first; this is the safety net
   * that keeps a schema rejection from surfacing as a 500.
   */
  if (err && err.name === "ValidationError" && err.errors) {
    const fields = {};
    for (const [path, detail] of Object.entries(err.errors)) fields[path] = detail.message;
    return res.status(400).json(ApiError.validation("Some fields are invalid.", fields).toBody());
  }

  if (err && err.name === "CorsError") {
    return res.status(403).json(new ApiError(403, "FORBIDDEN", "Origin not allowed.").toBody());
  }

  console.error("[error]", err);
  const body = ApiError.server().toBody();
  if (!env.isProduction) body.error.detail = err && err.message;
  return res.status(500).json(body);
}

module.exports = { notFoundHandler, errorHandler };
