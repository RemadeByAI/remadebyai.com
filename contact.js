// "List your app" form on the List your app page (/list/, from partials/list.html). The form stays hidden (and the email
// button stays the only way in) until the form has both data-endpoint
// (the forms Worker URL) and data-sitekey (the Cloudflare Turnstile site key).
// When configured, a "Fill in the form" button opens it; it starts collapsed.
// The Worker lives in forms-worker/; setup steps are in forms-worker/README.md.
(() => {
  const form = document.getElementById('list-form');
  if (!form) return;
  const { endpoint, sitekey } = form.dataset;
  if (!endpoint || !sitekey) return;

  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const buttonLabel = button.textContent;
  const widget = form.querySelector('.turnstile');
  const progress = form.querySelector('.form-progress');
  let widgetId = null;
  let turnstileLoading = false;

  // Collapsed by default: a toggle button opens and closes the form.
  const action = document.querySelector('.list-app-action');
  const emailButton = action && action.querySelector('.button.primary');
  if (emailButton) { emailButton.classList.remove('primary'); emailButton.textContent = 'Or email us instead'; }
  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'button primary form-toggle';
  toggle.setAttribute('aria-controls', 'list-form');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span class="form-toggle-label">Fill in the form</span><span class="chevron" aria-hidden="true">▾</span>';
  if (action) action.insertBefore(toggle, action.firstChild);

  function loadTurnstile() {
    if (turnstileLoading) return;
    turnstileLoading = true;
    window.onTurnstileLoad = () => {
      widgetId = window.turnstile.render(widget, { sitekey, theme: 'dark' });
    };
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad&render=explicit';
    script.async = true;
    document.head.appendChild(script);
  }

  function setOpen(open) {
    form.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.querySelector('.form-toggle-label').textContent = open ? 'Hide the form' : 'Fill in the form';
    if (open) {
      loadTurnstile();
      form.querySelector('input[name="name"]').focus({ preventScroll: true });
      form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }
  toggle.addEventListener('click', () => setOpen(form.hidden));
  if (location.hash === '#list-form') setOpen(true);

  function say(text, kind) {
    status.textContent = text;
    status.className = 'form-status' + (kind ? ' ' + kind : '');
  }

  function setSending(sending) {
    button.disabled = sending;
    button.classList.toggle('is-sending', sending);
    button.innerHTML = sending ? '<span class="spinner" aria-hidden="true"></span>Sending…' : buttonLabel;
    form.setAttribute('aria-busy', String(sending));
    if (progress) progress.hidden = !sending;
  }

  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (button.disabled) return;
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
    setSending(true);
    say('Sending your request. This can take a few seconds…');
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
      setSending(false);
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    }
  });
})();
