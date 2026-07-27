# ARO Communications Hardening

This note documents the final hardening pass for Email Presentations and Model Portal.

## Production environment

- `RATE_LIMIT_HASH_SALT` is required in production.
- Generate it with `openssl rand -base64 32`.
- Store it only in Vercel environment variables.
- Do not commit the generated value.

## Presentation links

- New sent presentation links are stored in `presentation_share_links`.
- Sending a presentation no longer rewrites `presentations.public_token_hash`.
- Previously sent links remain valid unless the presentation or share link is revoked or expired.
- Public media is resolved by `public_media_key`, never by array position.

## Model Portal review

- OTP verification is handled by `verify_model_update_code`.
- Wrong OTP submissions increment `attempt_count`.
- Admin approval uses `apply_model_update_submission` so selected fields, approved files, snapshots, and audit events are applied transactionally.
- Legacy `measurements` requests are accepted, but new forms send structured measurement fields.

## Upload validation

- Public uploads are validated server-side after signed upload completion.
- Stored object content type, size, and SHA-256 must match the authorized upload.
- Mismatches are rejected and the stored object is removed.

## Disposable PostgreSQL test

Use only a blank temporary database or local Supabase database:

```bash
ARO_TEST_DATABASE_URL="postgresql://..." npx tsx scripts/validate-communications-real-db.ts
```

The script refuses the known ARO production project host/ref and does not run remote migrations against production.
