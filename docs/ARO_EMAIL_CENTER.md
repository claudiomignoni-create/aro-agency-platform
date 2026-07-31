# ARO Email Center

## Purpose

`/admin/email` is the administrative Gmail webmail for ARO. It combines the
real connected mailbox, outbound operations, presentation delivery, secure
presentation access and Google Workspace connection state.

The webmail never invents data. Unavailable or empty Gmail data renders an
explicit operational state.

## Dashboard data

- **E-mails enviados:** `outbound_emails` with `status = sent`.
- **Modelos apresentados:** distinct model IDs from immutable presentation
  snapshots linked to sent outbound emails.
- **Apresentações realizadas:** distinct sent presentations linked to a
  recipient and share link.
- **Respostas recebidas:** visible in the real Gmail thread after the ARO
  account authorizes `gmail.modify`.
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

- `/admin/email` and `/admin/email/inbox`: Gmail Inbox.
- `/admin/email/compose`: individual composer and presentation preview.
- `/admin/email/thread/[threadId]`: complete sanitized Gmail thread.
- `/admin/email/draft/[draftId]`: Gmail draft editor.
- `/admin/email/trash`, `/starred`, `/label/[labelId]`: Gmail folders.
- `/admin/email/scheduled`: ARO scheduled delivery records.
- `/admin/email/activity`: recent operational timeline.
- `/admin/email/drafts`: real Gmail drafts.
- `/admin/email/sent`: real Gmail Sent threads.
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
- Gmail Inbox, Sent, drafts, labels, thread reads and safe mailbox actions are
  available through the server-only webmail layer.
- Incremental synchronization with `users.watch`, Pub/Sub and `history.list`
  remains a future phase.

## Migration

This webmail release adds no migration. The existing encrypted connection and
outbound delivery schema is sufficient for direct Gmail API reads.
