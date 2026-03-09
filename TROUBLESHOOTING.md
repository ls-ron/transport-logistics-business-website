# Troubleshooting: Quote Form & API

This guide explains dev logging, common errors, and how to fix them.

---

## Browser extension noise in the console

If you see errors like **"Document already loaded"**, **"AdUnit"**, **"content-script.js"**, **"Could not establish connection. Receiving end does not exist"**, or **"chrome-extension://..."** in the dev console, they come from **browser extensions** (e.g. ad blockers, password managers) injecting into the page. They are **not from this site's code** and cannot be fixed in the project.

To reduce noise: disable extensions for this site, use a different browser profile, or test in an **Incognito/Private window** with extensions turned off.

---

## Dev logging

### API (`/api/quote`)

All server-side logs are prefixed with **`[QUOTE]`** and a **stage tag**:

| Stage       | When it runs |
|-------------|--------------|
| `[INIT]`    | Start of request: env keys, whether DB is bound |
| `[PARSE]`   | Reading/parsing request body (Content-Type, JSON parse) |
| `[VALIDATE]`| Validation: payload fields, phone/email format |
| `[DB]`      | D1 insert (if `env.DB` is bound); or "env.DB is not bound" |
| `[EMAIL]`   | Email: config check, Resend call, success/failure (skipped if env vars missing) |
| `[WEBHOOK]` | Webhook: POST to `QUOTE_WEBHOOK_URL`, success/failure (skipped if not set) |
| `[SUCCESS]` | 200 response sent |
| `[ERROR]`   | Caught errors (with message and stack) |

**Where to look**

- **Local:** Terminal where you ran `wrangler pages dev .`
- **Production:** Cloudflare dashboard > Workers & Pages > your project > Logs (Real-time or Tail)

---

### Frontend (`script.js`)

Form-side logs are prefixed with **`[QUOTE_FORM]`**:

- Before submit: `[QUOTE_FORM] Sending` with URL and payload keys
- On server error: `[QUOTE_FORM] Server error` (status, error, details, full body)
- On validation errors: `[QUOTE_FORM] Validation errors` (array)

**Where to look:** Browser DevTools > Console.

---

## Common errors and fixes

### 1. 500 "An unexpected error occurred" or "Database is not available"

**Cause:** D1 database not bound, or table/schema mismatch.

**What to do**

1. Check **terminal logs** for `[QUOTE][DB]` or `[QUOTE][ERROR]` messages.
2. **Local dev:** Ensure D1 is bound in `wrangler.toml` and you've run the migration (`wrangler d1 execute quotes-db --local --file=./schema.sql`).
3. **Production:** Bind the D1 database to your Pages project and ensure the `quotes` table exists (same schema as in `schema.sql`).

---

### 2. Email not arriving (but form returns success)

**Cause:** Email env vars missing or incorrect. Email failures are logged but never cause a 500 -- the user always gets `{ success: true }` if the DB insert worked.

**What to do**

1. Check the terminal for `[QUOTE][EMAIL]` logs:
   - **"Email config missing"** -- One or more of `EMAIL_FROM`, `EMAIL_TO`, `RESEND_API_KEY` is not set in `.dev.vars` (local) or Pages env (production).
   - **"Resend API error"** -- The API key is wrong, or the from/to addresses are invalid. Check the logged status and body.
2. **Local dev:** Create `.dev.vars` from `.dev.vars.example` and set real values. Restart `wrangler pages dev .` after changes.
3. **Production:** In Cloudflare dashboard > Workers & Pages > your project > Settings > Environment variables, set `EMAIL_FROM`, `EMAIL_TO`, and `RESEND_API_KEY`.

See `EMAIL_TESTING.md` for full setup instructions.

---

### 3. 400 "Invalid JSON" or "Content-Type must be application/json"

**Cause:** Request body not valid JSON or wrong Content-Type.

**What to do**

- The frontend should send `Content-Type: application/json` and `JSON.stringify` the body. Check `[QUOTE_FORM] Sending` and that you're not double-encoding or changing the body.
- If you call the API from another client (Postman, curl), use `Content-Type: application/json` and a valid JSON body.

---

### 4. 400 validation errors (e.g. "Phone number format is invalid", "Email format is invalid")

**Cause:** Server-side validation (see `[QUOTE][VALIDATE]` in logs).

**What to do**

- Ensure phone is NZ format: leading `0` and 7-10 digits (e.g. `022 123 1234`).
- Ensure email matches a valid format.
- Check `[QUOTE][VALIDATE]` for the exact validation errors returned.

---

### 5. Database errors in logs ("Database insert failed")

**Cause:** D1 not bound, or table/schema mismatch.

**What to do**

- **Local:** Ensure D1 is bound in `wrangler.toml` and run `wrangler d1 execute quotes-db --local --file=./schema.sql`.
- **Production:** Bind the D1 database to your Pages project and ensure the `quotes` table exists (same schema as in `schema.sql`).
- See `DATABASE_SETUP.md` for full instructions.

---

## Quick reference: env vars

| Variable            | Required | Purpose |
|---------------------|----------|---------|
| `EMAIL_FROM`        | For email | Sender email address for Resend |
| `EMAIL_TO`          | For email | Recipient for quote notifications |
| `RESEND_API_KEY`    | For email | Resend API key (starts with `re_`) |
| `QUOTE_WEBHOOK_URL` | Optional  | Webhook URL to forward quotes to Zapier/Make/Google Sheets |

If the email vars are not set, email is silently skipped. If `QUOTE_WEBHOOK_URL` is not set, the webhook is skipped. Neither causes an error.

---

## Log flow (order of stages)

1. **INIT** -- Request start, env keys.
2. **PARSE** -- Body read and JSON parsed (or error).
3. **VALIDATE** -- Payload extracted and validated (or 400 with errors).
4. **DB** -- Insert into D1 (or 500 if DB not bound / insert fails).
5. **EMAIL** -- Send via Resend (skipped if config missing; failure logged only).
6. **WEBHOOK** -- POST to webhook URL (skipped if not set; failure logged only).
7. **SUCCESS** -- 200 response.
8. **ERROR** -- Any unexpected throw (with message and stack).

Use this order to see where a request stopped when debugging.
