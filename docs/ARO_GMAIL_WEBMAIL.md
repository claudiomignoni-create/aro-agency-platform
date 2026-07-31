# ARO Gmail Webmail

## Purpose

The Email Center reads and organizes the mailbox for `claudio@arolab.co` through
the Gmail API. The Gmail message body remains in Gmail and is not copied to
Supabase.

## OAuth

The requested scopes are:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.modify`

The integration does not request `https://mail.google.com/`. Existing
connections authorized only with `gmail.compose` must be reconnected. Access and
refresh tokens continue to use the existing encrypted
`google_workspace_connections` record.

## Server Layer

`src/lib/communications/gmail-mailbox-server.ts` is server-only and implements:

- labels and custom folders;
- paginated Inbox, Sent, Trash and Starred threads;
- Gmail drafts;
- Gmail search syntax;
- complete thread reads;
- read/unread, star/unstar, archive, trash and restore;
- draft create/update/send;
- reply and forward draft creation;
- authenticated attachment downloads with a size limit.

The first page is limited to 25 threads. List metadata is cached briefly in
server memory and invalidated after mailbox mutations. Message bodies are loaded
only when a thread is opened and are never added to that cache.

## Message Safety

Received HTML is processed through an allowlist sanitizer. Scripts, forms,
iframes, event handlers, unsafe schemes, embedded objects and remote images are
discarded. Remote image presence is shown as a blocked-content notice. Links
receive `noopener`, `noreferrer` and `nofollow`.

Attachment downloads require an authenticated administrator, use `private,
no-store`, sanitize the filename, set `nosniff`, and enforce a 20 MB limit.
There is no permanent-delete Gmail operation.

## Interface

The webmail has four internal panels inside the existing ARO Admin shell:

1. mailbox folders and Gmail labels;
2. paginated thread list and Gmail search;
3. thread reader or composer;
4. presentation preview or thread context.

Together with the global ARO sidebar, this recreates the five-area reference
layout. At tablet widths the preview is removed. On mobile the folder drawer,
thread list, reader and composer become separate route-driven views.

## Presentations

The composer lists real published presentations. Its preview endpoint reads the
published snapshot, signs approved model images for a short period, and returns
only a safe administrative DTO. Sending a presentation continues through the
existing one-recipient secure delivery flow so each company receives an
individual link.

## Synchronization

This release uses direct server reads, explicit refresh and short metadata
caching. It does not configure polling or Pub/Sub.

A future incremental phase can add:

1. `users.watch` to register the mailbox;
2. a private Google Cloud Pub/Sub topic;
3. stored `historyId` synchronization state;
4. `history.list` processing with a full-sync fallback when history expires.

That phase may require a migration for synchronization state. No migration is
required or included in this release.

## Operational Guardrails

- Gmail calls are server-only.
- The account must be exactly `claudio@arolab.co`.
- Send operations retain the existing idempotency record.
- External sending still depends on `EMAIL_EXTERNAL_SEND_ENABLED`.
- Preview validation must not send, reply, archive, star or trash any message.
- Mutating production validation requires explicit user authorization.
