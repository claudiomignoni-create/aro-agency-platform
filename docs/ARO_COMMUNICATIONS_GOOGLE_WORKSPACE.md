# ARO Communications, Presentations and Model Portal

This release adds the foundation for:

- Google Workspace OAuth connection for `claudio@arolab.co`.
- Email Center with system drafts, Gmail drafts, controlled test send and queue states.
- Profile update requests with secure hashed public tokens.
- Public update links under `/update/[token]`.
- Presentations with immutable snapshot-oriented public links under `/p/[token]`.
- Model Portal sections for profile, measurements, materials, documents, jobs, travel, payments, requests and settings.

## Required Environment Variables

Never commit real values.

```bash
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://aro-agency-platform.vercel.app/api/integrations/google/callback
EMAIL_TOKEN_ENCRYPTION_KEY=
NEXT_PUBLIC_APP_URL=https://aro-agency-platform.vercel.app
```

`EMAIL_TOKEN_ENCRYPTION_KEY` should be a high-entropy 32-byte base64 or hex value. Tokens are encrypted with AES-256-GCM.

## Google Cloud Setup

1. Create or select the ARO Google Cloud project.
2. Enable Gmail API.
3. Configure the OAuth consent screen for the Google Workspace account.
4. Use an internal app when available for the Workspace.
5. Create an OAuth Client of type Web application.
6. Add the authorized redirect URI:
   `https://aro-agency-platform.vercel.app/api/integrations/google/callback`
7. Add the production domain as an authorized domain.
8. Save `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Vercel environment variables.
9. Redeploy production.
10. In Admin Settings, open Integrations and connect Google Workspace.

The app expects the connected account to be exactly `claudio@arolab.co`. Any other account is rejected.

## Scopes

The app requests only:

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.compose`

It does not request full mailbox read access.

## Migration

Local migration:

`supabase/migrations/025_email_presentations_model_portal.sql`

Do not apply remotely before:

1. Running the manual database backup workflow.
2. Confirming workflow success.
3. Downloading the artifact.
4. Validating `roles.sql`, `schema.sql`, `data.sql`.
5. Validating checksums.
6. Confirming the remote migration history.

No `db reset`, migration repair or destructive cleanup is part of this release.

## Safety Rules

- Real test email is restricted to `claudio@arolab.co`.
- Third-party sending should remain disabled until OAuth, templates, queue and audit are validated.
- Public presentation links use token hashes in the database and must expose only authorized snapshots.
- Update links use token hashes and require review for sensitive data.
- Sensitive data must not be auto-applied: documents, passport, visa, address, banking, PIX, health and legal IDs.
- Published/sent presentations must not change silently. Generate a new version instead.

## Still Manual

- Apply migration after backup.
- Configure Google Cloud OAuth credentials.
- Configure Vercel environment variables.
- Connect `claudio@arolab.co`.
- Send the one allowed test email to `claudio@arolab.co`.
- Perform authenticated desktop/tablet/mobile smoke tests.
