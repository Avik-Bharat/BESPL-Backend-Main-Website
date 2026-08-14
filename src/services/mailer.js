"use strict";

const fs = require("fs");
const nodemailer = require("nodemailer");
const { env } = require("../config/env");
const { getBrochure, brochureFilePath } = require("../lib/brochures");

const mail = env.mail;
const isConfigured = Boolean(mail.host && mail.user && mail.pass);
const fromAddress = mail.from || (mail.user ? `"Bharat Engineering Services" <${mail.user}>` : "");

let transporter = null;

if (isConfigured) {
  transporter = nodemailer.createTransport({
    host: mail.host,
    port: mail.port,
    secure: mail.secure, // true for 465, false for 587 (STARTTLS)
    auth: { user: mail.user, pass: mail.pass },
    pool: true,
    maxConnections: 3
  });
} else {
  console.warn("[mail] SMTP is not configured — submissions will be stored but no email is sent.");
}

/** Confirms the credentials at boot instead of on the first real lead. */
async function verifyTransport() {
  if (!transporter) return false;
  try {
    await transporter.verify();
    console.log(`[mail] SMTP ready (${mail.host}:${mail.port})`);
    return true;
  } catch (err) {
    console.error("[mail] SMTP verification failed:", err.message);
    return false;
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Renders a label/value table; blank values are skipped. */
function detailsTable(rows) {
  const cells = rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:6px 12px 6px 0;color:#666;vertical-align:top;white-space:nowrap;">${escapeHtml(label)}</td>
           <td style="padding:6px 0;color:#111;">${escapeHtml(value).replace(/\n/g, "<br />")}</td>
         </tr>`
    )
    .join("");

  return `<table cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;">${cells}</table>`;
}

function wrap(title, innerHtml) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:#111;">
    <h2 style="margin:0 0 16px;font-size:18px;">${escapeHtml(title)}</h2>
    ${innerHtml}
  </div>`;
}

function plainText(rows) {
  return rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `${label}: ${value}`)
    .join("\n");
}

async function send(message) {
  if (!transporter) return null;
  return transporter.sendMail({ from: fromAddress, ...message });
}

/**
 * Never let a mail failure turn a stored lead into a 500 for the visitor —
 * the lead is already safe in MongoDB by the time these run.
 */
function sendSafely(label, message) {
  return send(message)
    .then((info) => {
      if (info) console.log(`[mail] ${label} sent (${info.messageId})`);
    })
    .catch((err) => console.error(`[mail] ${label} failed:`, err.message));
}

function formatWhen(date) {
  return new Date(date).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", hour12: true }) + " IST";
}

/* -------------------------------------------------------------------------- */
/* Enquiry                                                                    */
/* -------------------------------------------------------------------------- */

async function sendEnquiryEmails(doc) {
  if (!transporter) return;

  const rows = [
    ["Name", doc.name],
    ["Email", doc.email],
    ["Phone", doc.phone],
    ["Service", doc.service],
    ["Message", doc.message],
    ["Received", formatWhen(doc.createdAt)],
    ["IP", doc.ip],
    ["Reference", String(doc._id)]
  ];

  const jobs = [];

  if (mail.salesRecipients.length > 0) {
    jobs.push(
      sendSafely("enquiry notification", {
        to: mail.salesRecipients,
        replyTo: doc.email,
        subject: `New website enquiry — ${doc.name}${doc.service ? ` (${doc.service})` : ""}`,
        text: plainText(rows),
        html: wrap("New enquiry from the website", detailsTable(rows))
      })
    );
  }

  if (mail.autoReply) {
    const summary = [
      ["Service", doc.service],
      ["Message", doc.message]
    ];
    jobs.push(
      sendSafely("enquiry auto-reply", {
        to: doc.email,
        subject: "We received your enquiry — Bharat Engineering Services",
        text:
          `Hi ${doc.name},\n\n` +
          "Thank you for reaching out to Bharat Engineering Services. " +
          "Our team has received your enquiry and will reply within one working day.\n\n" +
          (plainText(summary) ? `Your enquiry:\n${plainText(summary)}\n\n` : "") +
          "Regards,\nBharat Engineering Services Pvt. Ltd.",
        html: wrap(
          `Hi ${doc.name}, thank you for your enquiry`,
          `<p style="font-size:14px;">Our team has received your enquiry and will reply within one working day.</p>
           ${detailsTable(summary)}
           <p style="font-size:14px;margin-top:20px;">Regards,<br />Bharat Engineering Services Pvt. Ltd.</p>`
        )
      })
    );
  }

  await Promise.all(jobs);
}

/* -------------------------------------------------------------------------- */
/* Brochure request                                                           */
/* -------------------------------------------------------------------------- */

function brochureAttachment(key) {
  if (!mail.attachBrochure) return null;

  const filePath = brochureFilePath(key);
  if (!filePath || !fs.existsSync(filePath)) {
    console.warn(`[mail] brochure PDF not found for "${key}" — sending without an attachment.`);
    return null;
  }
  return { filename: `${getBrochure(key).label}.pdf`, path: filePath, contentType: "application/pdf" };
}

async function sendBrochureEmails(doc) {
  if (!transporter) return;

  const brochure = getBrochure(doc.brochure);
  const label = brochure ? brochure.label : doc.brochure;

  const rows = [
    ["Name", doc.name],
    ["Email", doc.email],
    ["Phone", doc.phone],
    ["Brochure", label],
    ["Message", doc.message],
    ["Received", formatWhen(doc.createdAt)],
    ["IP", doc.ip],
    ["Reference", String(doc._id)]
  ];

  const jobs = [];

  if (mail.salesRecipients.length > 0) {
    jobs.push(
      sendSafely("brochure notification", {
        to: mail.salesRecipients,
        replyTo: doc.email,
        subject: `Brochure downloaded: ${label} — ${doc.name}`,
        text: plainText(rows),
        html: wrap("A lead downloaded a brochure", detailsTable(rows))
      })
    );
  }

  // The browser download can be blocked, so the requester also gets the PDF.
  const attachment = brochureAttachment(doc.brochure);
  jobs.push(
    sendSafely("brochure delivery", {
      to: doc.email,
      subject: `Your brochure: ${label} — Bharat Engineering Services`,
      text:
        `Hi ${doc.name},\n\n` +
        `Thank you for your interest in our ${label} offering.` +
        (attachment ? " The brochure is attached to this email." : "") +
        "\n\nIf you would like a detailed proposal, simply reply to this email.\n\n" +
        "Regards,\nBharat Engineering Services Pvt. Ltd.",
      html: wrap(
        `Hi ${doc.name}, here is your brochure`,
        `<p style="font-size:14px;">Thank you for your interest in our <strong>${escapeHtml(label)}</strong> offering.
         ${attachment ? "The brochure is attached to this email." : ""}</p>
         <p style="font-size:14px;">If you would like a detailed proposal, simply reply to this email.</p>
         <p style="font-size:14px;margin-top:20px;">Regards,<br />Bharat Engineering Services Pvt. Ltd.</p>`
      ),
      attachments: attachment ? [attachment] : []
    })
  );

  await Promise.all(jobs);
}

module.exports = { isConfigured, verifyTransport, sendEnquiryEmails, sendBrochureEmails };
