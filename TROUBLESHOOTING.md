# Troubleshooting: Quote Form & API

This guide explains dev logging, common errors, and how to fix them.

---

## Browser extension noise in the console

If you see errors like **"Document already loaded"**, **"AdUnit"**, **"content-script.js"**, **"Could not establish connection. Receiving end does not exist"**, or **"chrome-extension://..."** in the dev console, they come from **browser extensions** (e.g. ad blockers, password managers) injecting into the page. They are **not from this site’s code** and cannot be fixed in the project.

To reduce noise: disable extensions for this site, use a different browser profile, or test in an **Incognito/Private window** with extensions turned off.

---

## Dev logging

### API (`/api/quote`)

All server-side logs are prefixed with **`[QUOTE]`** and a **stage tag**:

| Stage     | When it runs |
|----------|----------------|
| `[INIT]` | Start of request: context, env keys, and whether EMAIL_FROM, EMAIL_TO, RESEND_API_KEY, DB are set |
| `[PARSE]`| Reading/parsing request body (Content-Type, body read method, JSON parse) |
| `[VALIDATE]` | Validation: payload fields, phone/email format |
| `[DB]`   | D1 insert (if `env.DB` is bound); or "No env.DB bound, skipping" |
| `[EMAIL]`| Sending email: config check, Resend call, success/failure |
| `[SUCCESS]` | 200 response sent |
| `[ERROR]` | Caught errors; message and (if `DEBUG_EMAIL_ERRORS=1`) stack |

**Where to look**

- **Local:** Terminal where you ran `wrangler pages dev .`
- **Production:** Cloudflare dashboard → Workers & Pages → your project → Logs (Real-time or Tail)

**See error details in API responses**

- Set **`DEBUG_EMAIL_ERRORS=1`** in `.dev.vars` (local) or in Pages env (production).  
  Then 500 responses include `details: { message, name, stack }`.
- Even without that, **`details.message`** is always included on 500 errors so the UI can show the real error (e.g. missing env).

---

### Frontend (`script.js`)

Form-side logs are prefixed with **`[QUOTE_FORM]`**:

- Before submit: `[QUOTE_FORM] Sending` with URL and payload keys
- On server error: `[QUOTE_FORM] Server error` (status, error, details, full body)
- On validation errors: `[QUOTE_FORM] Validation errors` (array)

**Where to look:** Browser DevTools → Console.

---

## Common errors and fixes

### 1. 500 "An unexpected error occurred" or "Failed to send notification email"

**Cause:** Usually missing or invalid env for the quote API (email or DB).

**What to do**

1. Check **terminal (or Cloudflare logs)** for `[QUOTE][ERROR]` or `[QUOTE][EMAIL]` and the message/stack.
2. Check the **browser console** for `[QUOTE_FORM] Server details:` — the API returns `details.message` with the real error (e.g. "EMAIL_FROM and EMAIL_TO must be configured...").
3. **Local dev:** Create `.dev.vars` from `.dev.vars.example` and set:
   - `EMAIL_FROM` – sender address (e.g. `onboarding@resend.dev` for Resend)
   - `EMAIL_TO` – where to receive quote notifications
   - `RESEND_API_KEY` – from [Resend](https://resend.com) (e.g. `re_...`)
4. **Optional for local only:** To test the form without email, set **`DEV_SKIP_EMAIL=1`** in `.dev.vars`. The API will return 200 and skip sending email.

**Example .dev.vars (minimal):**

```bash
EMAIL_FROM=onboarding@resend.dev
EMAIL_TO=you@example.com
RESEND_API_KEY=re_xxxxxxxxxxxx
```

---

### 2. 500 and logs say "RESEND_API_KEY must be configured" or Resend API error

**Cause:** Missing or wrong Resend API key, or Resend API returned an error.

**What to do**

- Add **`RESEND_API_KEY`** to `.dev.vars` (local) or Pages env (production). Get a key from https://resend.com.
- If the log shows **Resend API error (4xx/5xx)**, check `[QUOTE][EMAIL]` for the response body; fix the from/to addresses or API key as needed.

---

### 3. 500 and logs say "EMAIL_FROM and EMAIL_TO must be configured"

**Cause:** Env vars not loaded or not set.

**What to do**

- **Local:** Ensure `.dev.vars` exists in the **project root** (same folder as `wrangler.toml` or where you run `wrangler pages dev .`). Restart `wrangler pages dev` after changing `.dev.vars`.
- **Production:** In Cloudflare dashboard → Workers & Pages → your Pages project → Settings → Environment variables, set `EMAIL_FROM` and `EMAIL_TO` for the right environment (Production/Preview).

---

### 4. 400 "Invalid JSON" or "Content-Type must be application/json"

**Cause:** Request body not valid JSON or wrong Content-Type.

**What to do**

- The frontend should send `Content-Type: application/json` and `JSON.stringify` the body. Check `[QUOTE_FORM] Sending` and that you’re not double-encoding or changing the body.
- If you call the API from another client (Postman, curl), use `Content-Type: application/json` and a valid JSON body.

---

### 5. 400 validation errors (e.g. "Phone number format is invalid", "Email format is invalid")

**Cause:** Server-side validation (see `[QUOTE][VALIDATE]` in logs).

**What to do**

- Ensure phone is NZ format: leading `0` and 7–10 digits (e.g. `022 123 1234`).
- Ensure email matches a valid format.
- Check `[QUOTE][VALIDATE]` for the exact validation errors returned.

---

### 6. Database errors in logs ("Database insert failed")

**Cause:** D1 not bound, or table/schema mismatch.

**What to do**

- **Local:** D1 is optional; the request still succeeds and email is still sent. To use D1 locally, bind it in `wrangler.toml` and run migrations (see `DATABASE_SETUP.md` / `schema.sql`).
- **Production:** Bind the D1 database to your Pages project and ensure the `quotes` table exists (same schema as in `schema.sql`).

---

## Quick reference: env vars

| Variable            | Required | Purpose |
|---------------------|----------|--------|
| `EMAIL_FROM`        | Yes*     | Sender email for Resend |
| `EMAIL_TO`          | Yes*     | Recipient for quote notifications |
| `RESEND_API_KEY`    | Yes*     | Resend API key |
| `DEBUG_EMAIL_ERRORS`| No       | Set to `1` to include full error (stack) in 500 responses |
| `DEV_SKIP_EMAIL`    | No       | Set to `1` in dev to skip sending email and return 200 |

\*Not required if `DEV_SKIP_EMAIL=1` in local dev.

---

## Log flow (order of stages)

1. **INIT** – Request start, env keys and flags.
2. **PARSE** – Body read and JSON parsed (or error).
3. **VALIDATE** – Payload extracted and validated (or 400 with errors).
4. **DB** – Insert into D1 if `env.DB` is set (or skip).
5. **EMAIL** – Send via Resend (or 500 / or 200 if `DEV_SKIP_EMAIL=1`).
6. **SUCCESS** – 200 response.
7. **ERROR** – Any unexpected throw (with message and optional stack).

Use this order to see where a request stopped when debugging.
