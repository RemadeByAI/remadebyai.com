# RemadeByAI forms Worker

Receives the "List your app" form on remadebyai.com and emails each request to
`listings@remadebyai.com`, sent from `forms@enclosemail.com` through Cloudflare
Email Routing. Cloudflare Turnstile keeps bots out, and a hidden honeypot field
catches simple spam scripts. No dependencies.

- `src/index.js`: the Worker (CORS, Turnstile check, sending).
- `src/lib.js`: field rules and the email itself (plain text, UTF-8).
- `wrangler.toml`: name, route (`forms.enclosemail.com`), the `send_email` binding and settings.

The site side is `contact.js` plus the `#list-form` form in `index.html`. The form
stays hidden, and the email button stays the only way in, until the form's
`data-endpoint` and `data-sitekey` attributes are both filled in.

## One-time Cloudflare setup

1. **Email Routing on enclosemail.com:** Cloudflare dashboard > enclosemail.com >
   Email > Email Routing > enable. Cloudflare adds its MX and SPF records to
   enclosemail.com (fine as long as enclosemail.com receives no other mail).
2. **Verify the recipient:** Email Routing > Destination addresses > add
   `listings@remadebyai.com` and click the link in the email Cloudflare sends.
   The mailbox must exist in Microsoft 365 first.
3. **Turnstile:** dashboard > Turnstile > Add widget, hostname `remadebyai.com`,
   mode Managed. Keep the site key (public) and secret key (private).
4. **Deploy the Worker** from this folder:
   ```
   npx wrangler login
   npx wrangler deploy
   npx wrangler secret put TURNSTILE_SECRET   # paste the Turnstile secret key
   ```
   `wrangler deploy` also creates the `forms.enclosemail.com` custom domain.
5. **Turn the form on:** in `index.html`, set
   `data-endpoint="https://forms.enclosemail.com/submit"` and
   `data-sitekey="<Turnstile site key>"`, run `node build.js`, commit and push.

## Testing locally

```
printf 'TURNSTILE_SECRET=1x0000000000000000000000000000000AA\n' > .dev.vars
npx wrangler dev --var ALLOWED_ORIGINS:http://localhost:8765
```

Local sends are written to `.wrangler/tmp/email/` as .eml files instead of being
delivered. Turnstile's test site key is `1x00000000000000000000AA`.
`TURNSTILE_VERIFY_URL` can point the check at a local stub when
challenges.cloudflare.com is unreachable.
