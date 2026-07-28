# ARO Public Presentation Experience

## Scope

The public route `/p/[token]` is an editorial client experience built on the
immutable presentation snapshots introduced by migration 025. It does not read
live model profiles and does not expose administrative model records.

The experience includes:

- presentation identity, message, recipient name when bound to the link, and expiry;
- model navigation with Overview, Book, Digitals, Video, and Downloads;
- one Yes, Maybe, or No decision per snapshot model;
- an optional structured client note;
- idempotent final submission;
- sanitized presentation activity events;
- responsive sidebar, galleries, dialogs, and mobile decision controls.

## Data Boundaries

Only fields already copied into a published presentation snapshot are eligible
for display. New snapshots may include commercial fields such as measurements,
hair, eyes, nationality, categories, location, and Instagram when enabled.

The public payload must not include:

- legal names, CPF, RG, passports, addresses, phone numbers, or bank data;
- raw storage bucket names or paths;
- recipient email addresses;
- token plaintext;
- internal notes or administrative model identifiers.

Old snapshots remain unchanged and use empty-state fallbacks for unavailable
fields.

## Security Model

The plaintext token remains only in the private URL. Server code hashes it with
SHA-256 before every database lookup.

Every decision, final submission, activity event, and download:

1. validates token hash structure;
2. resolves the current share link or legacy presentation link;
3. validates published status, expiry, revocation, and archive state;
4. binds the operation to the immutable snapshot;
5. rejects model keys outside that snapshot;
6. runs through server-only RPCs using the service role;
7. applies the communication rate limiter.

Private media is resolved server-side from the immutable snapshot. Browser
access uses short-lived signed URLs. Download links are revalidated before a
60-second signed URL is issued.

## Migration 026

`026_presentation_model_selections.sql` is additive and creates:

- `presentation_selection_responses`;
- `presentation_model_selections`;
- server-only link-state, decision, submission, and event RPCs;
- RLS and admin policies;
- additional communication rate-limit operations.

The response scope is either a recipient share link or a legacy presentation
link. The child table has a unique constraint on response plus
`public_model_key`, preserving one current decision per model.

Changing a decision after submission clears the submitted state so the client
can review and submit the revised selection. Repeating an unchanged submission
returns the existing timestamp and does not create another submission event.

## Compatibility

Links created by migration 025 keep their token format and continue to resolve.
When the application is deployed before migration 026, presentations remain
readable and the selection controls show a schema-pending notice.

No email is sent after selection submission in this phase. The Admin can read
the RLS-protected response and decision tables for a future response view.

## Validation

Technical validation:

```bash
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

Disposable Supabase validation:

```bash
ARO_TEST_DATABASE_URL="..." \
ARO_TEST_DATABASE_CONFIRM=DISPOSABLE \
ARO_TEST_DATABASE_ALLOWED_HOSTS="allowed-host" \
npm run test:communications:db
```

The database script rejects the known production project, requires an empty
Supabase-compatible database, applies 001 through 025, inserts an existing
presentation fixture, upgrades to 026, and validates selection behavior, RLS,
grants, old-link compatibility, idempotency, expiry, revocation, and
not-published states.
