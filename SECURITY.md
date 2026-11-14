# Security operations

- Deploy with `DATABASE_URL` using verified TLS (`sslmode=verify-full`). The application rejects an unverified database certificate.
- Set a long random `ADMIN_KEY` for login and separate long random `ADMIN_SESSION_SECRET` and `GALLERY_SESSION_SECRET` values in the deployment environment. The latter two are required for admin and gallery access. Keep all values out of Git and client-side variables.
- Set `PAYSTACK_SECRET_KEY` before enabling digital checkout. A buyer must return in the same browser used to start checkout; paid downloads require its HttpOnly purchase cookie.
- Finished gallery files and digital products must use Cloudinary `authenticated` delivery. Public originals are not served by the gallery or product download APIs. New uploads use authenticated delivery automatically.
- Run `npm run migrate:private-media` to preview older public originals, then `npm run migrate:private-media -- --apply` to move eligible files. Assets also referenced by public pages require a separate private reupload. Recheck with `node scripts/verify-private-media.mjs`.
- The application limits public requests using the client IP supplied by the trusted reverse proxy. On Vercel, `X-Forwarded-For` is overwritten by the platform. Other hosting setups must provide a trusted value.
- Run `npm audit` and `npm run build` before deployment. Verify admin login, gallery previews, paid downloads, and mail delivery after deployment.
