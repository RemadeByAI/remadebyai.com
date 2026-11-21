// RemadeByAI form handler (Cloudflare Worker).
// POST /submit with the "List your app" form fields. Checks Turnstile,
// validates the fields, then emails the request via Cloudflare Email Routing.
import { EmailMessage } from 'cloudflare:email';
import { buildSubmission, buildMime, json } from './lib.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
    const cors = allowed.includes(origin)
      ? { 'Access-Control-Allow-Origin': origin, 'Vary': 'Origin' }
      : {};

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' } });
    }
    if (url.pathname !== '/submit') return json({ ok: false, error: 'Not found.' }, 404, cors);
    if (request.method !== 'POST') return json({ ok: false, error: 'Use POST.' }, 405, cors);
    if (!cors['Access-Control-Allow-Origin']) return json({ ok: false, error: 'This form only works from remadebyai.com.' }, 403, cors);

    const length = Number(request.headers.get('Content-Length') || 0);
    if (length > 20000) return json({ ok: false, error: 'That message is too long.' }, 413, cors);

    let form;
    try { form = await request.formData(); }
    catch { return json({ ok: false, error: 'Could not read the form.' }, 400, cors); }

    // Honeypot: real visitors never fill this hidden field. Pretend success.
    if ((form.get('company_website') || '').toString().trim()) return json({ ok: true }, 200, cors);

    const token = (form.get('cf-turnstile-response') || '').toString();
    if (!token) return json({ ok: false, error: 'Please complete the "verify you are human" check.' }, 400, cors);
    const check = await verifyTurnstile(token, env.TURNSTILE_SECRET, request.headers.get('CF-Connecting-IP'), env.TURNSTILE_VERIFY_URL);
    if (!check) return json({ ok: false, error: 'The human check failed or expired. Please try again.' }, 400, cors);

    const { data, errors } = buildSubmission(form);
    if (errors.length) return json({ ok: false, error: errors.join(' ') }, 400, cors);

    const raw = buildMime({
      from: env.FROM_ADDRESS, fromName: env.FROM_NAME || 'RemadeByAI forms', to: env.TO_ADDRESS,
      replyTo: data.email, replyName: data.name, data, domain: env.FROM_ADDRESS.split('@')[1],
    });
    try {
      await env.MAILER.send(new EmailMessage(env.FROM_ADDRESS, env.TO_ADDRESS, raw));
    } catch (err) {
      console.error('send failed', err && err.message);
      return json({ ok: false, error: 'We could not send your message just now. Please email listings@remadebyai.com instead.' }, 502, cors);
    }
    return json({ ok: true }, 200, cors);
  },
};

async function verifyTurnstile(token, secret, ip, verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify') {
  if (!secret) return false;
  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (ip) body.append('remoteip', ip);
  try {
    const res = await fetch(verifyUrl, { method: 'POST', body });
    const out = await res.json();
    return out.success === true;
  } catch { return false; }
}
