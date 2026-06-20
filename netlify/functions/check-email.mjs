import crypto from 'node:crypto';

const COOKIE_NAME = 'mi_auth';
const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 30; // 30 days

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sign(payload, secret) {
  return b64url(crypto.createHmac('sha256', secret).update(payload).digest());
}

function getAllowedEmails() {
  const raw = process.env.ALLOWED_EMAILS || '';
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}

export default async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const email = (body && typeof body.email === 'string' ? body.email : '').trim().toLowerCase();
  if (!email || !email.includes('@')) {
    return new Response(JSON.stringify({ error: 'Invalid email' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const allowed = getAllowedEmails();
  if (!allowed.has(email)) {
    return new Response(JSON.stringify({ error: 'Not on the list' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SEC;
  const payload = `${b64url(email)}.${exp}`;
  const sig = sign(payload, secret);
  const cookieValue = `${payload}.${sig}`;

  const cookie = [
    `${COOKIE_NAME}=${cookieValue}`,
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SEC}`,
    'Secure',
    'SameSite=Lax',
  ].join('; ');

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'Set-Cookie': cookie,
    },
  });
};

export const config = { path: '/api/check-email' };
