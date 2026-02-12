/**
 * /api/quote – Cloudflare Pages Function
 *
 * DEV LOGGING & TROUBLESHOOTING
 * -----------------------------
 * All logs are prefixed with [QUOTE] and a stage tag. Stages:
 *   [INIT]     Request/env inspection
 *   [PARSE]    Reading and parsing request body
 *   [VALIDATE] Validation (required fields, email, phone)
 *   [DB]       D1 database insert (if env.DB bound)
 *   [EMAIL]    Sending notification email (if configured)
 *   [WEBHOOK]  Sending payload to external webhook (if configured)
 *   [SUCCESS]  Success response
 *   [ERROR]    Caught errors
 */

const LOG_PREFIX = '[QUOTE]';

function devLog(stage, message, data) {
  const payload = data !== undefined ? ` ${JSON.stringify(data)}` : '';
  console.log(`${LOG_PREFIX}[${stage}] ${message}${payload}`);
}

function devError(stage, message, err) {
  console.error(`${LOG_PREFIX}[${stage}] ${message}`, err?.message ?? err);
  if (err?.stack) console.error(`${LOG_PREFIX}[${stage}] stack:`, err.stack);
}

/**
 * Helper: send notification email via Resend
 * - Uses env.EMAIL_FROM, env.EMAIL_TO, env.RESEND_API_KEY
 * - Logs errors but never throws (to avoid breaking the user flow)
 */
async function sendQuoteEmail(payload, env) {
  const apiKey = env.RESEND_API_KEY;
  const from = env.EMAIL_FROM;
  const to = env.EMAIL_TO;

  if (!apiKey || !from || !to) {
    devError('EMAIL', 'Email config missing', {
      hasApiKey: !!apiKey,
      hasFrom: !!from,
      hasTo: !!to,
    });
    return;
  }

  const {
    name,
    phone,
    email,
    company,
    pickup,
    delivery,
    freightType,
  } = payload;

  const submittedAt = new Date().toISOString();

  const subject = 'New Cold Transport Quote Request';
  const textBody = [
    'New Cold Transport Quote Request',
    '================================',
    '',
    `Name:      ${name}`,
    `Company:   ${company || '—'}`,
    `Email:     ${email}`,
    `Phone:     ${phone}`,
    '',
    `Pickup:    ${pickup}`,
    `Delivery:  ${delivery}`,
    '',
    `Freight:   ${Array.isArray(freightType) ? freightType.join(', ') : '—'}`,
    '',
    `Submitted: ${submittedAt}`,
  ].join('\n');

  const htmlBody = `
    <h2>New Cold Transport Quote Request</h2>
    <p><strong>Name:</strong> ${name}</p>
    <p><strong>Company:</strong> ${company || '—'}</p>
    <p><strong>Email:</strong> ${email}</p>
    <p><strong>Phone:</strong> ${phone}</p>
    <p><strong>Pickup:</strong> ${pickup}</p>
    <p><strong>Delivery:</strong> ${delivery}</p>
    <p><strong>Freight Type:</strong> ${Array.isArray(freightType) ? freightType.join(', ') : '—'}</p>
    <p><strong>Submitted:</strong> ${submittedAt}</p>
  `;

  try {
    devLog('EMAIL', 'Sending email via Resend');
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      devError('EMAIL', 'Resend API error', { status: res.status, body });
      return;
    }

    devLog('EMAIL', 'Email sent successfully via Resend');
  } catch (err) {
    devError('EMAIL', 'Failed to send email via Resend', err);
  }
}

/**
 * Helper: send quote payload to an external webhook (e.g. Zapier/Make → Google Sheets)
 * - Uses env.QUOTE_WEBHOOK_URL
 * - Logs errors but never throws (to avoid breaking the user flow)
 */
async function sendQuoteToWebhook(payload, createdAt, env) {
  const url = env.QUOTE_WEBHOOK_URL;
  if (!url) {
    devLog('WEBHOOK', 'QUOTE_WEBHOOK_URL not set; skipping webhook');
    return;
  }

  const body = {
    ...payload,
    created_at: createdAt,
  };

  try {
    devLog('WEBHOOK', 'Sending quote to webhook', { url });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      devError('WEBHOOK', 'Webhook responded with non-2xx status', {
        status: res.status,
        body: text,
      });
      return;
    }

    devLog('WEBHOOK', 'Webhook call succeeded');
  } catch (err) {
    devError('WEBHOOK', 'Webhook call failed', err);
  }
}

/**
 * CORS headers helper
 */
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Cloudflare Pages Function: Handle CORS preflight requests
 */
export async function onRequestOptions(request, env, ctx) {
  return new Response(
    JSON.stringify({}),
    {
      status: 204,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Cloudflare Pages Function: Handle unsupported HTTP methods
 * Returns 405 Method Not Allowed for any method that isn't POST or OPTIONS
 */
export async function onRequest(request, env, ctx) {
  const method = request.method;
  
  // OPTIONS and POST are handled by specific handlers
  // This catches all other methods (GET, PUT, DELETE, PATCH, etc.)
  if (method !== 'POST' && method !== 'OPTIONS') {
    return new Response(
      JSON.stringify({
        success: false,
        error: `Method ${method} is not allowed. Use POST to submit a quote request.`,
      }),
      {
        status: 405,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Allow': 'POST, OPTIONS',
        },
      }
    );
  }
  
  // If somehow we reach here for POST/OPTIONS, let the specific handlers deal with it
  // This shouldn't happen, but return a generic error just in case
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Method handling error.',
    }),
    {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    }
  );
}

/**
 * Cloudflare Pages Function: Handle POST requests to /api/quote
 * Handles:
 * - POST with JSON body
 * - Basic server-side validation
 * - JSON responses with appropriate HTTP status codes
 * - Basic CORS for browser access
 * - Database persistence
 */
export async function onRequestPost({ request, env }) {
  devLog('INIT', 'Request start', {
    method: request.method,
    url: request.url,
    envKeys: Object.keys(env),
    hasDB: !!env.DB,
  });

  // --- Parse JSON body from request ---
  let payload;

  try {
    const contentType = request.headers.get('Content-Type');
    devLog('PARSE', 'Content-Type', { contentType });

    if (contentType && !contentType.includes('application/json')) {
      devLog('PARSE', 'Rejecting: Content-Type is not application/json');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Content-Type must be application/json.',
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    payload = await request.json();
    devLog('PARSE', 'JSON parsed', { keys: payload ? Object.keys(payload) : [] });
  } catch (jsonError) {
    devError('PARSE', 'JSON parse error', jsonError);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid JSON body. Please check your request format.',
        details: jsonError.message,
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    devLog('PARSE', 'Payload invalid or null', { type: typeof payload });
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Request body is required and must be a valid JSON object.',
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }

  // --- Validate fields ---
  try {
    const {
      name,
      phone,
      email,
      company,
      pickup,
      delivery,
      freightType,
    } = payload;

    devLog('VALIDATE', 'Payload extracted', { name: !!name, phone: !!phone, email: !!email, pickup: !!pickup, delivery: !!delivery, freightTypeCount: freightType?.length });

    const errors = [];

    // Required fields
    if (!name || typeof name !== 'string' || !name.trim()) {
      errors.push('Name is required.');
    }
    if (!phone || typeof phone !== 'string' || !phone.trim()) {
      errors.push('Phone is required.');
    }
    if (!email || typeof email !== 'string' || !email.trim()) {
      errors.push('Email is required.');
    }
    if (!pickup || typeof pickup !== 'string' || !pickup.trim()) {
      errors.push('Pickup location is required.');
    }
    if (!delivery || typeof delivery !== 'string' || !delivery.trim()) {
      errors.push('Delivery location is required.');
    }

    // Freight type must be a non-empty array
    if (
      !Array.isArray(freightType) ||
      freightType.length === 0 ||
      !freightType.every((t) => typeof t === 'string' && t.trim())
    ) {
      errors.push('At least one freight type is required.');
    }

    // Basic email format validation
    if (email && typeof email === 'string') {
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailPattern.test(email)) {
        errors.push('Email format is invalid.');
      }
    }

    // Loosely validate NZ phone number (same idea as frontend)
    if (phone && typeof phone === 'string') {
      const phoneDigits = phone.replace(/\s+/g, '');
      devLog('VALIDATE', 'Phone check', { original: phone, digits: phoneDigits, length: phoneDigits.length });
      if (!/^0\d{7,10}$/.test(phoneDigits)) {
        errors.push(`Phone number format is invalid. Expected NZ format (0 followed by 7-10 digits), got: ${phoneDigits}`);
      }
    }

    if (errors.length > 0) {
      devLog('VALIDATE', 'Validation failed', { errors });
      return new Response(
        JSON.stringify({
          success: false,
          error: errors[0],
          errors,
        }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    // At this point, the payload is valid.
    const createdAt = new Date().toISOString();
    const freightTypeStr = freightType.join(', ');

    // Store submission in D1 database (required)
    if (!env.DB) {
      devError('DB', 'env.DB is not bound');
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Database is not available. Please try again later.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    try {
      await env.DB.prepare(
        `INSERT INTO quotes (
          name, phone, email, company, pickup, delivery,
          freight_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          name.trim(),
          phone.trim(),
          email.trim(),
          company?.trim() || null,
          pickup.trim(),
          delivery.trim(),
          freightTypeStr,
          createdAt
        )
        .run();

      devLog('DB', 'Quote inserted successfully');
    } catch (dbError) {
      devError('DB', 'Database insert failed', dbError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to save quote. Please try again later.',
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fire-and-forget side effects: email + webhook.
    // These should NEVER cause the request to fail if DB insert succeeded.
    await Promise.allSettled([
      sendQuoteEmail(payload, env),
      sendQuoteToWebhook(payload, createdAt, env),
    ]);

    devLog('SUCCESS', 'Quote submitted');
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (err) {
    devError('ERROR', 'Unexpected error in onRequestPost', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'An unexpected error occurred. Please try again later.',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}
