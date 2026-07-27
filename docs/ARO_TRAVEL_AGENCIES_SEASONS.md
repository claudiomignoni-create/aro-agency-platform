# ARO Travel, Agencies and International Seasons

This release extends the ARO Command Center with partner agencies and international model seasons.

## Migrations

Apply after `010` to `018`, in this order:

- `019_partner_agencies.sql`
- `020_international_model_seasons.sql`
- `021_season_finance_and_documents.sql`
- `022_season_alerts_and_hardening.sql`
- `023_fix_international_season_alert_function.sql`
- `024_fix_international_season_two_month_alert.sql`

The new tables are admin-only through RLS. Travel and season documents use the private `model-documents` bucket with the `travel/` prefix.

## Admin Routes

- `/admin/agencies`
- `/admin/agencies/new`
- `/admin/agencies/[id]`
- `/admin/agencies/[id]/edit`
- `/admin/travel`
- `/admin/travel/[id]`
- `/admin/travel/[id]/edit`
- `/admin/travel/[id]/documents`
- `/admin/travel/[id]/finance`

## Dashboard Sources

- Active international seasons come from `model_international_seasons`.
- Travel fallback comes from `model_trips` when seasons are not available.
- Alerts come from `international_season_alerts`, flight segments, jobs, accounting and model document/profile checks.
- The world map only renders markers with stored coordinates.

## Seed

Run only after migrations `019` to `022` are applied:

```bash
npm run seed:nicolle-nextttone-season
```

The seed is idempotent. It requires an existing Nicolle Cunha/Nicole Cunha model and stops if none or multiple candidates are found. It creates or updates:

- Nexttt One as a partner agency.
- Nicolle Cunha international season with Nexttt One India 2026.
- A linked Travel trip.
- 50/40/10 revenue share rows.
- Contract/payment/return-ticket alerts.

Unknown money, currency, visa, flight, ticket, PNR and document values remain null or pending.
