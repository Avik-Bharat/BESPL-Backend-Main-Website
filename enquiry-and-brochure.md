# Backend API spec — Enquiry & Brochure requests

Two endpoints are needed for the marketing site (Next.js frontend in this repo). This doc
is written for a Node.js + Express + MongoDB (Mongoose) backend, deployed separately from
the frontend and reachable at `NEXT_PUBLIC_API_BASE_URL`.

- **Frontend calls:** `components/ContactForm.tsx` (Send Enquiry), `components/BrochureModal.tsx` (Get Brochure)
- **Base URL (env):** `NEXT_PUBLIC_API_BASE_URL`, e.g. `https://api.bharatengineeringservices.com`
- **Content type:** `application/json` for requests and responses
- **CORS:** allow the frontend origin(s) — production domain + `http://localhost:3000` for local dev
- **Transport:** HTTPS only in production

---

## 1. Send Enquiry

General contact-form enquiry submitted from the Contact page.

### `POST /api/v1/enquiries`

**Request body**

| Field     | Type   | Required | Notes                                  |
|-----------|--------|----------|-----------------------------------------|
| `name`    | string | yes      | 2–120 chars                             |
| `email`   | string | yes      | valid email format                      |
| `phone`   | string | no       | free text, 6–20 chars if present        |
| `service` | string | no       | free text, e.g. "Fire safety", "Solar"  |
| `message` | string | no       | max 2000 chars                          |

```json
{
  "name": "Aditi Rao",
  "email": "aditi@company.com",
  "phone": "+91 90734 02611",
  "service": "ETP/STP/RO",
  "message": "Need a 50 KLD STP for a residential site in Pune, timeline Q4."
}
```

**Success — `201 Created`**

```json
{
  "success": true,
  "data": {
    "id": "665f1c2e9b1d4a0012a3f9c1",
    "createdAt": "2026-08-14T10:22:31.000Z"
  }
}
```

**Validation error — `400 Bad Request`**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Name and email are required.",
    "fields": { "email": "Enter a valid email address." }
  }
}
```

**Rate limited — `429 Too Many Requests`** (see [Abuse protection](#abuse-protection))

**Server error — `500 Internal Server Error`**

```json
{ "success": false, "error": { "code": "SERVER_ERROR", "message": "Something went wrong. Try again shortly." } }
```

### Mongoose schema — `Enquiry`

```js
const enquirySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, match: /^\S+@\S+\.\S+$/ },
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
```

### Side effects (recommended, not required by the frontend contract)

- Send a notification email to the sales inbox(es) listed on the Contact page.
- Optionally send an auto-reply acknowledgement to the enquirer's email.

---

## 2. Get Brochure

Triggered by the "GET BROCHURE" button (`components/BrochureButton.tsx`), which opens a
modal (`components/BrochureModal.tsx`) asking for name, phone, email, which brochure to
send (dropdown) and an optional message. On success the frontend downloads the matching
static PDF from `/brochures/*` immediately — the API call exists to **capture the lead**,
not to serve the file.

### `POST /api/v1/brochure-requests`

**Request body**

| Field      | Type   | Required | Notes                                                      |
|------------|--------|----------|--------------------------------------------------------------|
| `name`     | string | yes      | 2–120 chars                                                 |
| `email`    | string | yes      | valid email format                                          |
| `phone`    | string | yes      | 6–20 chars                                                   |
| `brochure` | string | yes      | one of: `fire-safety`, `water-waste-treatment`, `solar-power-plants` |
| `message`  | string | no       | free text, max 2000 chars                                    |

```json
{
  "name": "Ravi Shah",
  "email": "ravi@company.com",
  "phone": "+91 89006 34272",
  "brochure": "solar-power-plants",
  "message": "Looking for a 500kW rooftop install, need pricing for a factory in Howrah."
}
```

**Success — `201 Created`**

Response includes `brochureUrl` so the frontend has a single source of truth for the file
path, even though the PDFs are also bundled statically under `/public/brochures`.

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

**Validation error — `400 Bad Request`**

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Select a brochure to continue.",
    "fields": { "brochure": "Must be one of fire-safety, water-waste-treatment, solar-power-plants." }
  }
}
```

**Rate limited — `429 Too Many Requests`**

**Server error — `500 Internal Server Error`**

### Brochure enum → file mapping

| `brochure` value          | Label                                    | File (in `public/brochures/`)   |
|----------------------------|-------------------------------------------|----------------------------------|
| `fire-safety`               | Fire and Safety                           | `BESPL- FIRE PPT.pdf`           |
| `water-waste-treatment`     | Water and Waste Water Treatment Solution  | `BESPL- WATER PPT.pdf`          |
| `solar-power-plants`        | Solar Power Plants                        | `BESPL- SOLAR PPT.pdf`          |

Keep this mapping identical on both frontend (`lib/data.ts` → `BROCHURES`) and backend so
the enum values never drift.

### Mongoose schema — `BrochureRequest`

```js
const BROCHURE_KEYS = ["fire-safety", "water-waste-treatment", "solar-power-plants"];

const brochureRequestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, match: /^\S+@\S+\.\S+$/ },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    brochure: { type: String, required: true, enum: BROCHURE_KEYS },
    message: { type: String, trim: true, maxlength: 2000 },
    source: { type: String, default: "website-brochure-modal" },
    ip: { type: String },
    userAgent: { type: String }
  },
  { timestamps: true }
);
```

### Side effects (recommended)

- Notify sales that a lead downloaded a specific brochure (useful for follow-up).
- Optionally email the PDF to the requester as an attachment instead of relying solely on
  the browser download, in case the download is blocked.

---

## Abuse protection

Both endpoints are public and unauthenticated, so:

- Rate-limit by IP, e.g. 5 requests / 10 minutes per endpoint (`express-rate-limit`).
- Validate and sanitize all string fields server-side (never trust the frontend validation).
- Reject requests with an honeypot field (e.g. hidden `company` input the frontend never
  fills) — if present and non-empty, silently return `201` without persisting.
- Log `ip` and `userAgent` per submission for later abuse review.

## Error shape (shared)

All error responses use the same envelope so the frontend can handle them generically:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Human-readable message.", "fields": { "field": "reason" } }
}
```

`code` is one of: `VALIDATION_ERROR`, `RATE_LIMITED`, `SERVER_ERROR`.

## Suggested backend layout

```
server/
  src/
    models/
      Enquiry.ts
      BrochureRequest.ts
    routes/
      enquiries.ts
      brochureRequests.ts
    middleware/
      rateLimit.ts
      validate.ts
    app.ts
    server.ts
  .env            # MONGODB_URI, PORT, ALLOWED_ORIGINS
  package.json
```

## Environment variables

| Var                | Used by  | Example                                             |
|---------------------|----------|------------------------------------------------------|
| `MONGODB_URI`        | backend  | `mongodb+srv://user:pass@cluster/bespl`             |
| `ALLOWED_ORIGINS`    | backend  | `https://bharatengineeringservices.com,http://localhost:3000` |
| `NEXT_PUBLIC_API_BASE_URL` | frontend | `https://api.bharatengineeringservices.com`   |
