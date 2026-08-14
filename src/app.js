"use strict";

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const mongoose = require("mongoose");

const { env } = require("./config/env");
const enquiriesRouter = require("./routes/enquiries");
const brochureRequestsRouter = require("./routes/brochureRequests");
const { notFoundHandler, errorHandler } = require("./middleware/errorHandler");

const app = express();

/**
 * Must be set for `req.ip` (and therefore the rate limiter) to see the real
 * client address behind a reverse proxy. Configurable via TRUST_PROXY.
 */
app.set("trust proxy", env.trustProxy);
app.disable("x-powered-by");

app.use(helmet());

/**
 * Only the configured site origins may call the API. Requests without an
 * `Origin` header (curl, uptime checks, server-to-server) are allowed through —
 * they are not browser cross-origin requests and CORS does not protect them.
 */
const corsOptions = {
  origin(origin, callback) {
    if (!origin || env.allowedOrigins.includes(origin)) return callback(null, true);
    const err = new Error(`Origin ${origin} is not allowed by CORS.`);
    err.name = "CorsError";
    return callback(err);
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Accept"],
  maxAge: 86400
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json({ limit: "32kb" }));
app.use(morgan(env.isProduction ? "combined" : "dev"));

app.get("/health", (req, res) => {
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  const readyState = mongoose.connection.readyState;
  res.status(readyState === 1 ? 200 : 503).json({
    success: readyState === 1,
    data: { status: readyState === 1 ? "ok" : "degraded", database: states[readyState] || "unknown", uptime: process.uptime() }
  });
});

app.use("/api/v1/enquiries", enquiriesRouter);
app.use("/api/v1/brochure-requests", brochureRequestsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
