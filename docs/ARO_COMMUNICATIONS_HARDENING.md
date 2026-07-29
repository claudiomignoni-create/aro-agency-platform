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
- Recipient, share link and outbound email creation happens in one `create_presentation_delivery` transaction.
- Repeating the same request nonce returns the existing delivery and never requeues a sent email.
- Public media is resolved by `public_media_key`, never by array position.

## Model Portal review

- OTP verification is handled by `verify_model_update_code`.
- Wrong OTP submissions increment `attempt_count`.
- OTP email content is encrypted with AES-256-GCM until the worker sends it and is then erased.
- Public token RPCs are server-only and executable by `service_role`, not by `anon` or ordinary `authenticated` clients.
- Public autosave responses contain only requested non-sensitive draft fields and return no draft after submission.
- Admin approval uses `apply_model_update_submission` so selected fields, approved files, snapshots, and audit events are applied transactionally.
- Legacy `measurements` requests are accepted, but new forms send structured measurement fields.

## Upload validation

- Public uploads are validated server-side after signed upload completion.
- Stored object content type, binary signature, size, and SHA-256 must match the authorized upload.
- Mismatches are rejected and the stored object is removed.
- Synchronous video validation is limited to 25 MB. Larger video support requires a durable worker.

## Disposable Supabase test

Use only a blank Supabase local database or a disposable Supabase staging project. Generic PostgreSQL is not sufficient because the migrations and behavioral checks require the `auth` and `storage` schemas.

```bash
ARO_TEST_DATABASE_URL="postgresql://..." \
ARO_TEST_DATABASE_CONFIRM=DISPOSABLE \
ARO_TEST_DATABASE_ALLOWED_HOSTS="127.0.0.1" \
npm run test:communications:db
```

The script:

- refuses the known ARO production project ref;
- requires an explicit host allowlist;
- refuses databases with public tables, Auth users or Storage objects;
- applies the complete sequence `001-026`;
- verifies RPC permissions, model isolation, OTP attempts, sensitive drafts, presentation links, delivery idempotency, concurrent queue claims and transactional rollback.
