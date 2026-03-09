# Email Notifications (Resend)

When a quote is submitted, the API sends you an email notification via [Resend](https://resend.com).

Email is **automatic** -- if the three env vars below are set, every successful quote submission triggers an email. If any are missing, email is silently skipped (logged as `[QUOTE][EMAIL] Email config missing` in the terminal).

## 1. Get a Resend API key

1. Sign up at [resend.com](https://resend.com).
2. In the dashboard, create or copy an **API key** (starts with `re_`).

## 2. Configure `.dev.vars`

Copy `.dev.vars.example` to `.dev.vars` and fill in your values:

```bash
# Email notification (Resend) -- required for email to work
EMAIL_FROM=onboarding@resend.dev
EMAIL_TO=your-real-email@example.com
RESEND_API_KEY=re_xxxxxxxxxxxx
```

- **EMAIL_FROM** -- Sender address. Use `onboarding@resend.dev` for testing (Resend's sandbox). For production, use your own verified domain.
- **EMAIL_TO** -- Where quote notifications go (your email).
- **RESEND_API_KEY** -- Your Resend API key (starts with `re_`).

## 3. Restart the dev server

After saving `.dev.vars`:

```bash
# Stop the current server (Ctrl+C), then:
npx wrangler pages dev .
```

## 4. Test

Submit the quote form. You should:
- Get a 200 success response in the browser.
- See `[QUOTE][EMAIL] Email sent successfully via Resend` in the terminal.
- Receive the notification in the inbox for **EMAIL_TO**.

## 5. What if I don't want email locally?

Just leave `RESEND_API_KEY` empty or remove the email vars from `.dev.vars`. The API will still work -- it saves to the database and returns `{ success: true }`. Email is only attempted when all three vars are present. You'll see `[QUOTE][EMAIL] Email config missing` in the logs, which is harmless.

## Production

In the Cloudflare dashboard, set the same three env vars (`EMAIL_FROM`, `EMAIL_TO`, `RESEND_API_KEY`) under your Pages project:

**Workers & Pages** > your project > **Settings** > **Environment variables** > Production
