# BESPL Backend — Enquiry & Brochure API

Node.js + Express + MongoDB (Mongoose) + Nodemailer service backing the two public
forms on the Bharat Engineering Services website:

| Form | Frontend component | Endpoint |
|------|--------------------|----------|
| Contact page → **Send now** | `components/ContactForm.tsx` | `POST /api/v1/enquiries` |
| **GET BROCHURE** modal → **Download brochure** | `components/BrochureModal.tsx` | `POST /api/v1/brochure-requests` |

Every submission is stored in MongoDB, emailed to sales, and acknowledged to the
visitor. Brochure requesters also receive the PDF as an attachment, so a blocked
browser download does not cost the lead.

---

## 1. Setup

```bash
cd backend
npm install
cp .env.example .env      # then fill in the values below
npm run dev               # http://localhost:5000
```

Requires Node 18.17 or newer (the code uses `fetch`-era Node APIs and modern syntax).

### What you need to supply in `.env`

**`MONGODB_URI`** — the MongoDB Atlas connection string.
Atlas → *Database* → *Connect* → *Drivers*. Add the database name before the `?`:

```
mongodb+srv://user:pass@cluster0.abcde.mongodb.net/bespl?retryWrites=true&w=majority
```

If the password contains `@`, `#`, `/` or `:` it must be URL-encoded (`@` → `%40`).
In Atlas → *Network Access*, allow your server's IP (or `0.0.0.0/0` if the host has
no static IP).

**`SMTP_PASS`** — a Gmail **App Password**, not the account password:

1. The sending Google account must have 2-Step Verification enabled.
2. Go to <https://myaccount.google.com/apppasswords>.
3. Create one named e.g. "BESPL website" and copy the 16 characters.
4. Paste it into `SMTP_PASS` (spaces are fine, Gmail ignores them).

`SMTP_USER` must be that same mailbox, and `MAIL_FROM` must use that address —
Gmail rewrites the `From` header otherwise. For Google Workspace on the company
domain the settings are identical, just with the `@bharatengineeringservices.com`
mailbox.

Using a provider other than Gmail? Only `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE`
change — port `465` with `SMTP_SECURE=true`, or `587` with `SMTP_SECURE=false`.

**`ALLOWED_ORIGINS`** — comma-separated site origins, no trailing slash. Required in
production; a browser request from any other origin is rejected with `403`.

**`SALES_RECIPIENTS`** — who gets the new-lead email.

If SMTP is left blank the API still runs and still stores every lead — it just logs
a warning and sends nothing. Losing email never loses a lead.

---

## 2. API

Base path `/api/v1`. Requests and responses are `application/json`.

### `POST /api/v1/enquiries`

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 2–120 chars |
| `email` | string | yes | valid email, stored lowercased |
| `phone` | string | no | 6–20 chars |
| `service` | string | no | max 120 chars |
| `message` | string | no | max 2000 chars |

```json
{ "success": true, "data": { "id": "665f1c2e9b1d4a0012a3f9c1", "createdAt": "2026-08-14T10:22:31.000Z" } }
```

### `POST /api/v1/brochure-requests`

| Field | Type | Required | Rules |
|-------|------|----------|-------|
| `name` | string | yes | 2–120 chars |
| `email` | string | yes | valid email |
| `phone` | string | yes | 6–20 chars |
| `brochure` | string | yes | `fire-safety` \| `water-waste-treatment` \| `solar-power-plants` |
| `message` | string | no | max 2000 chars |

```json
{
  "success": true,
  "data": {
    "id": "665f1e0a9b1d4a0012a3f9c4",
    "brochure": "solar-power-plants",
    "brochureUrl": "/brochures/BESPL- SOLAR PPT.pdf",
    "createdAt": "2026-08-14T10:31:02.000Z"
  }
}
```

### `GET /api/v1/brochure-requests/options`

Returns the brochure enum with labels and URLs, so the modal's dropdown can be
driven by the API instead of a second hard-coded copy of the list.

### `GET /health`

`200` when MongoDB is connected, `503` otherwise. Point your host's health check here.

### Errors

Every failure uses one envelope:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Name and email are required.", "fields": { "email": "Enter a valid email address." } }
}
```

`code` is `VALIDATION_ERROR` (400), `RATE_LIMITED` (429), `FORBIDDEN` (403),
`NOT_FOUND` (404) or `SERVER_ERROR` (500). `fields` is present only when specific
fields failed.

---

## 3. Behaviour worth knowing

- **Rate limit** — 5 requests / 10 minutes / IP, counted **per endpoint**, so the
  contact form and the brochure modal have separate budgets. Tune with
  `RATE_LIMIT_MAX` and `RATE_LIMIT_WINDOW_MS`.
- **Honeypot** — a non-empty `company` field means a bot. The API returns `201` as
  if nothing happened and stores nothing.
- **Email is a side effect** — the lead is saved and the response sent first, then
  mail goes out in the background. A dead SMTP server produces a log line, never a
  failed submission for the visitor.
- **Server-side validation only** — the frontend's checks are treated as untrusted.
  Fields are whitelisted by name before they reach Mongoose, so a body like
  `{"email": {"$ne": null}}` is rejected rather than interpreted as a query.
- **`TRUST_PROXY`** — set to the number of reverse proxies in front of the app
  (Render / Railway / Nginx = `1`). Too high a value lets a client forge
  `X-Forwarded-For` and walk past the rate limiter.

## 4. Brochure enum

`src/lib/brochures.js` must stay in sync with `BROCHURES` in the frontend's
`lib/data.ts`:

| Key | Label | File |
|-----|-------|------|
| `fire-safety` | Fire and Safety | `BESPL- FIRE PPT.pdf` |
| `water-waste-treatment` | Water and Waste Water Treatment Solution | `BESPL- WATER PPT.pdf` |
| `solar-power-plants` | Solar Power Plants | `BESPL- SOLAR PPT.pdf` |

The PDFs live in `backend/brochures/` for the email attachment, and in the
frontend's `public/brochures/` for the browser download.

## 5. Docker

```bash
docker build -t bespl-backend .
docker run --rm -p 5000:5000 --env-file .env bespl-backend
```

The image is a two-stage Alpine build, runs as a non-root user, and exposes a
`HEALTHCHECK` against `/health`. `.env` is never baked into the image — pass real
config at `docker run` time (`--env-file`) or via your host's secret store.

## 6. Deploying

1. Deploy this folder to Render / Railway / a VPS. Start command: `npm start`.
2. Set every variable from `.env.example` in the host's dashboard — **not** as a
   committed `.env`.
3. Put the API behind HTTPS on e.g. `https://api.bharatengineeringservices.com`.
4. Set `NEXT_PUBLIC_API_BASE_URL` to that URL in the frontend's environment and
   redeploy it. No frontend code changes are needed.
5. Confirm the production domain is listed in `ALLOWED_ORIGINS`.

Quick check once it is live:

```bash
curl -X POST https://api.bharatengineeringservices.com/api/v1/enquiries \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"you@example.com","message":"Testing"}'
```

## 7. Layout

```
backend/
  brochures/                     PDFs used as email attachments
  src/
    config/env.js                env parsing + startup validation
    lib/
      ApiError.js                error envelope
      brochures.js               brochure enum, labels, file paths
      requestMeta.js             ip + user-agent capture
    middleware/
      errorHandler.js            404 + central error handler
      rateLimit.js               per-endpoint IP limiter
      validate.js                sanitising validators
    models/
      Enquiry.js
      BrochureRequest.js
    routes/
      enquiries.js
      brochureRequests.js
    services/mailer.js           Nodemailer transport + templates
    app.js                       Express app (CORS, helmet, routes)
    server.js                    DB connect, listen, graceful shutdown
  .env.example
  package.json
```
