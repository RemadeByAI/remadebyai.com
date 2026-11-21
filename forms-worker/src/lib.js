// Pure helpers (no Workers-only imports), so they can be tested with plain Node.

export const FIELDS = [
  // [form name, label, required, max length]
  ['name', 'Your name', true, 100],
  ['email', 'Your email', true, 200],
  ['app_name', 'App name', true, 100],
  ['app_url', 'Website or download link', true, 500],
  ['replaces', 'What familiar software it replaces', true, 200],
  ['source', 'Source code (if open source)', false, 500],
  ['maker', 'Who makes it', false, 200],
  ['about', 'About the app, and how AI was part of building it', true, 4000],
];

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]+$/;
const URL_RE = /^https?:\/\/[^\s]+$/i;

export function buildSubmission(form) {
  const data = {};
  const errors = [];
  for (const [key, label, required, max] of FIELDS) {
    const value = (form.get(key) || '').toString().replace(/\r\n?/g, '\n').trim();
    if (required && !value) errors.push(`${label} is required.`);
    else if (value.length > max) errors.push(`${label} is too long (${max} characters at most).`);
    data[key] = value;
  }
  // Single-line fields must not carry newlines (they go into headers or one-line slots).
  for (const key of ['name', 'email', 'app_name', 'app_url', 'replaces', 'source', 'maker']) data[key] = data[key].replace(/\s+/g, ' ');
  if (data.email && !EMAIL_RE.test(data.email)) errors.push('Please enter a valid email address.');
  if (data.app_url && !URL_RE.test(data.app_url)) errors.push('The website link should start with http:// or https://.');
  if (data.source && !URL_RE.test(data.source)) errors.push('The source code link should start with http:// or https://.');
  return { data, errors };
}

function encodeWord(text) {
  // RFC 2047 encoded-word, so names and subjects with any characters are header-safe.
  return /^[\x20-\x7e]*$/.test(text) && !/[=?"<>(),;:@\\]/.test(text)
    ? text
    : `=?UTF-8?B?${b64(text)}?=`;
}

function b64(text) {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function wrap76(s) { return s.replace(/.{1,76}/g, '$&\r\n').trimEnd(); }

export function buildBody(data) {
  const lines = ['New "List your app" request from remadebyai.com', ''];
  for (const [key, label] of FIELDS) {
    if (key === 'about') continue;
    lines.push(`${label}: ${data[key] || '(not given)'}`);
  }
  lines.push('', 'About the app, and how AI was part of building it:', data.about, '', '--', 'Reply to this email to answer the sender directly.');
  return lines.join('\n');
}

export function buildMime({ from, fromName, to, replyTo, replyName, data, domain, now = new Date(), id = crypto.randomUUID() }) {
  const subject = `List my app: ${data.app_name}`;
  const headers = [
    `From: ${encodeWord(fromName)} <${from}>`,
    `To: <${to}>`,
    `Reply-To: ${encodeWord(replyName)} <${replyTo}>`,
    `Subject: ${encodeWord(subject)}`,
    `Date: ${now.toUTCString().replace('GMT', '+0000')}`,
    `Message-ID: <${id}@${domain}>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: base64',
  ];
  return headers.join('\r\n') + '\r\n\r\n' + wrap76(b64(buildBody(data))) + '\r\n';
}

export function json(body, status, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
