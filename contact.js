// "List your app" form on the List your app page (/list/, from partials/list.html). It is the only way to send a request.
// The form stays hidden until it has both data-endpoint (the forms Worker URL) and data-sitekey (the Cloudflare Turnstile
// site key); when configured, it is always shown.
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

  // Show the form and load Turnstile. Only move the cursor to it when the link asked for the form (#list-form),
  // so the header search keeps focus on a normal page load.
  form.hidden = false;
  loadTurnstile();
  if (location.hash === '#list-form') {
    form.querySelector('input[name="name"]').focus({ preventScroll: true });
    form.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

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

  // After a successful send, swap the fields for a clear "we got it" panel, so nobody
  // wonders whether it worked and sends the same request again.
  const fields = [...form.children].filter(el => el !== status);
  const sent = document.createElement('div');
  sent.className = 'form-sent';
  sent.hidden = true;
  sent.setAttribute('tabindex', '-1');
  sent.innerHTML = '<p class="form-sent-title">✓ Got it, thanks!</p>' +
    '<p class="form-sent-text"></p>' +
    '<button type="button" class="button form-sent-again">List another app</button>';
  form.appendChild(sent);
  function showSent(appName) {
    sent.querySelector('.form-sent-text').textContent =
      `Your request${appName ? ` for ${appName}` : ''} reached us. There's no need to send it again. We read every request and reply when we add a listing.`;
    fields.forEach(el => { el.hidden = true; });
    sent.hidden = false;
    sent.focus({ preventScroll: true });
    sent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  sent.querySelector('.form-sent-again').addEventListener('click', () => {
    sent.hidden = true;
    fields.forEach(el => { el.hidden = el.classList.contains('form-progress'); });
    form.querySelector('input[name="name"]').focus();
  });

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
        const appName = (data.get('app_name') || '').toString().trim();
        form.reset();
        say('');
        showSent(appName);
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
