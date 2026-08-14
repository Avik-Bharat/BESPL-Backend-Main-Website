"use strict";

/**
 * Every failure the API returns is an ApiError, so the response envelope
 * documented in the spec is produced in exactly one place (errorHandler).
 *
 * `code` is one of: VALIDATION_ERROR | RATE_LIMITED | SERVER_ERROR | NOT_FOUND.
 */
class ApiError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace?.(this, ApiError);
  }

  static validation(message, fields) {
    return new ApiError(400, "VALIDATION_ERROR", message, fields);
  }

  static notFound(message = "Resource not found.") {
    return new ApiError(404, "NOT_FOUND", message);
  }

  static server(message = "Something went wrong. Try again shortly.") {
    return new ApiError(500, "SERVER_ERROR", message);
  }

  toBody() {
    const error = { code: this.code, message: this.message };
    if (this.fields && Object.keys(this.fields).length > 0) error.fields = this.fields;
    return { success: false, error };
  }
}

module.exports = ApiError;
