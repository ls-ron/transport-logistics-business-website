// Helper: send email via a transactional provider (e.g. Resend, Mailgun, SendGrid)
async function sendQuoteEmail(payload, env) {
  // Choose provider based on environment, default to RESEND-style HTTP API
  const provider = (env.EMAIL_PROVIDER || 'resend').toLowerCase();

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

  // All providers require at least: API key, from, and to addresses
  const from = env.EMAIL_FROM;
  const to = env.EMAIL_TO;

  if (!from || !to) {
    throw new Error('EMAIL_FROM and EMAIL_TO must be configured in environment.');
  }

  if (provider === 'resend') {
    const apiKey = env.RESEND_API_KEY;
    if (!apiKey) {
      throw new Error('RESEND_API_KEY must be configured in environment.');
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: 'New Cold Transport Quote Request',
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`Resend API error (${res.status}): ${errText}`);
    }
    return;
  }

  // Placeholder branches for other providers (Mailgun, SendGrid, etc.)
  // Implementations can be added here later based on env.EMAIL_PROVIDER.
  throw new Error(`Unsupported email provider: ${provider}`);
}

export default {
  /**
   * Cloudflare Pages Function / Worker-style handler for /api/quote
   * Handles:
   * - POST with JSON body
   * - Basic server-side validation
   * - JSON responses with appropriate HTTP status codes
   * - Basic CORS for browser access
   * - Email notification on successful submission
   */
  async fetch(request, env, ctx) {
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    if (request.method !== 'POST') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Method not allowed. Use POST.',
        }),
        {
          status: 405,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
          },
        }
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON body.',
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

    const {
      name,
      phone,
      email,
      company,
      pickup,
      delivery,
      freightType,
    } = payload || {};

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
      if (!/^0\d{7,10}$/.test(phoneDigits)) {
        errors.push('Phone number format is invalid.');
      }
    }

    if (errors.length > 0) {
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
    // Extract IP address from Cloudflare headers
    const ipAddress =
      request.headers.get('CF-Connecting-IP') ||
      request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
      request.headers.get('X-Real-IP') ||
      null;

    // Generate timestamp
    const submittedAt = new Date().toISOString();

    // Store submission in D1 database
    if (env.DB) {
      try {
        // Prepare freight type as JSON string
        const freightTypeJson = JSON.stringify(freightType);

        await env.DB.prepare(
          `INSERT INTO quotes (
            name, email, phone, company, pickup, delivery, 
            freight_type, ip_address, submitted_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
          .bind(
            name.trim(),
            email.trim(),
            phone.trim(),
            company?.trim() || null,
            pickup.trim(),
            delivery.trim(),
            freightTypeJson,
            ipAddress,
            submittedAt
          )
          .run();
      } catch (dbError) {
        // Log database error but don't fail the request
        // Email notification will still be sent
        console.error('Database storage error:', dbError);
        // In production, you might want to log this to an error tracking service
      }
    }

    // Send email notification; if this fails, return 500 so the frontend can show an error.
    try {
      await sendQuoteEmail(payload, env);
    } catch (err) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to send notification email. Please try again later.',
          details: env.DEBUG_EMAIL_ERRORS ? String(err) : undefined,
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

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Quote request received successfully.',
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  },
};

