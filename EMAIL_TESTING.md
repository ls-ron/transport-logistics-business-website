# Option B: Test Real Email (Resend)

Use this when you want the quote form to actually send notification emails instead of skipping email in dev.

## 1. Get a Resend API key

1. Sign up at [resend.com](https://resend.com).
2. In the dashboard, create or copy an **API key** (starts with `re_`).

## 2. Configure `.dev.vars`

Edit `.dev.vars` in the project root so it looks like this (use your own values):

```bash
# Remove or comment out so email is sent:
# DEV_SKIP_EMAIL=1

# Required for sending quote emails
EMAIL_FROM=onboarding@resend.dev
EMAIL_TO=your-email@example.com
RESEND_API_KEY=re_xxxxxxxxxxxx
```

- **EMAIL_FROM** – Sender address. For testing you can use `onboarding@resend.dev` (Resend’s test domain). For production you’ll use your own verified domain.
- **EMAIL_TO** – Where quote notifications should go (your email).
- **RESEND_API_KEY** – The API key from Resend (e.g. `re_...`).

## 3. Restart the dev server

After saving `.dev.vars`:

```bash
# Stop the current server (Ctrl+C), then:
npx wrangler pages dev .
```

## 4. Test

Submit the quote form. You should get a 200 success and see the email in the inbox for **EMAIL_TO**. Check the terminal for `[QUOTE][EMAIL] Resend API success`.

## 5. Back to “no email” (Option A)

To go back to form-only testing without sending email, set in `.dev.vars`:

```bash
DEV_SKIP_EMAIL=1
```

and remove or comment out `EMAIL_FROM`, `EMAIL_TO`, and `RESEND_API_KEY` if you like. Restart `wrangler pages dev .` after changes.
