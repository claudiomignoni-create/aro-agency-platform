# ARO Email Center

## Purpose

`/admin/email` is the administrative communication command center for ARO. It
combines outbound email operations, presentation delivery, secure presentation
access, model profile update requests and Google Workspace connection state.

The dashboard never invents data. Empty databases render explicit empty states.

## Dashboard data

- **E-mails enviados:** `outbound_emails` with `status = sent`.
- **Modelos apresentados:** distinct model IDs from immutable presentation
  snapshots linked to sent outbound emails.
- **Apresentações realizadas:** distinct sent presentations linked to a
  recipient and share link.
- **Respostas recebidas:** unavailable until ARO explicitly authorizes an
  additional Gmail read scope.
- **Atividade:** outbound email state changes, presentation access events and
  model update request state, always identifying the recorded ARO sender.
- **Desempenho:** presentation-link access, unopened presentation links, failed
  email operations and pending/scheduled operations.
- **Destaque:** presentation email with the most safe-link access in the
  selected period. OTP messages are excluded.
- **Ranking:** models appearing in sent presentation snapshots.

`get_email_center_dashboard(period_start, period_end)` aggregates these values
in one admin-only RPC. The function rejects non-admin callers and returns no
tokens, hashes, raw IPs, documents, private model data or full message bodies.

## Definitions

An “Apresentação aberta” means the recipient accessed the secure presentation
link. The system does not claim that the email itself was opened.

No tracking pixel is used. No raw IP address is stored for analytics.

## Routes

- `/admin/email`: dashboard.
- `/admin/email/compose`: individual composer and preview.
- `/admin/email/activity`: recent operational timeline.
- `/admin/email/drafts`: system and Gmail drafts.
- `/admin/email/sent`: completed deliveries.
- `/admin/email/queue`: scheduled, queued, processing, retry and failed items.
- `/admin/email/templates`: reusable templates.
- `/admin/email/reports`: period analytics and model ranking.
- `/admin/email/settings`: sender, scopes and privacy.
- `/admin/email/[id]`: sanitized operational detail.

Presentation emails continue to use
`/admin/presentations/[id]/email`, which creates the recipient, versioned share
link and outbound email transactionally.

## Safety rules

- A sent email is never reprocessed with the same idempotency key.
- Duplicate and retry operations create a new system draft.
- OTP messages cannot be duplicated and never reveal their private payload.
- Queue recipient edits are allowed only before processing.
- Follow-ups open as a new draft with recipient and subject prefilled.
- Scheduled or queued real delivery remains restricted by the existing safe
  recipient gate.
- Errors displayed to administrators are sanitized.
- Gmail inbox and reply synchronization remain disabled.

## Migration

All schema work remains inside
`supabase/migrations/025_email_presentations_model_portal.sql` because migration
025 has not yet been applied remotely. No migration in this branch is applied
automatically.
