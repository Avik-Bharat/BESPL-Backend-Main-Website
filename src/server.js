"use strict";

const mongoose = require("mongoose");

const { env, assertRequiredEnv } = require("./config/env");
const app = require("./app");
const { verifyTransport } = require("./services/mailer");

// Reject unknown keys in queries/updates instead of silently ignoring them.
mongoose.set("strictQuery", true);

let server;

async function start() {
  assertRequiredEnv();

  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 10000,
    maxPoolSize: 10
  });
  console.log(`[db] connected to MongoDB (${mongoose.connection.name})`);

  // Non-fatal: leads are still captured if SMTP is down.
  await verifyTransport();

  server = app.listen(env.port, () => {
    console.log(`[api] listening on port ${env.port} (${env.nodeEnv})`);
    console.log(`[api] allowed origins: ${env.allowedOrigins.join(", ") || "(none configured)"}`);
  });
}

async function shutdown(signal) {
  console.log(`[api] ${signal} received — shutting down.`);
  try {
    if (server) await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close(false);
    process.exit(0);
  } catch (err) {
    console.error("[api] error during shutdown:", err);
    process.exit(1);
  }
}

["SIGINT", "SIGTERM"].forEach((signal) => process.on(signal, () => shutdown(signal)));

process.on("unhandledRejection", (reason) => console.error("[api] unhandled rejection:", reason));
process.on("uncaughtException", (err) => {
  console.error("[api] uncaught exception:", err);
  process.exit(1);
});

start().catch((err) => {
  console.error("[api] failed to start:", err.message);
  process.exit(1);
});
