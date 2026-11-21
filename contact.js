// "List your app" form on the home page. The form stays hidden (and the email
// button stays the only way in) until index.html's form has both data-endpoint
// (the forms Worker URL) and data-sitekey (the Cloudflare Turnstile site key).
// The Worker lives in forms-worker/; setup steps are in forms-worker/README.md.
(() => {
  const form = document.getElementById('list-form');
  if (!form) return;
  const { endpoint, sitekey } = form.dataset;
  if (!endpoint || !sitekey) return;

  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const widget = form.querySelector('.turnstile');
  let widgetId = null;

  form.hidden = false;
  const emailButton = document.querySelector('.list-app-action .button.primary');
  if (emailButton) { emailButton.classList.remove('primary'); emailButton.textContent = 'Or email us instead'; }

  // Load Turnstile only when the form is in use.
  window.onTurnstileLoad = () => {
    widgetId = window.turnstile.render(widget, { sitekey, theme: 'dark' });
  };
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
  script.async = true;
  document.head.appendChild(script);

  function say(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    let firstBad = null;
    for (const field of form.querySelectorAll('input, textarea')) {
      if (field.name === 'company_website') continue;
      const bad = !field.checkValidity();
      field.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (bad && !firstBad) firstBad = field;
    }
    if (firstBad) {
      say('Please fill in the highlighted fields.', 'error');
      firstBad.focus();
      return;
    }
    const data = new FormData(form);
    if (!data.get('cf-turnstile-response')) {
      say('Please complete the "verify you are human" check.', 'error');
      return;
    }
    button.disabled = true;
    say('Sending…');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: data });
      const out = await res.json().catch(() => ({}));
      if (res.ok && out.ok) {
        form.reset();
        say('Thanks! Your request is on its way. We reply to every request when we add a listing.', 'ok');
      } else {
        say(out.error || 'Something went wrong. Please email listings@remadebyai.com instead.', 'error');
      }
    } catch {
      say('Could not reach the server. Please email listings@remadebyai.com instead.', 'error');
    } finally {
      button.disabled = false;
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
