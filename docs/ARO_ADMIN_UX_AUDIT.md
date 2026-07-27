# ARO Admin UX Audit

## Baseline

- Branch: `main`
- Base inspected: `57addfe13470e8aac49d4c18788e44a6c805e04f`
- Scope: `/admin/**`
- Reference: current ARO Jobs screen, with VEIN Calendar used only as a navigation/interaction reference.

## Findings

### Shared Shell

- `/admin/**` already uses `AdminShellV2` through `src/app/admin/layout.tsx`.
- The shell already provides the ARO blue background, Liquid Glass variables, responsive drawer, global search, notifications, profile menu, and dark/light/system theme state.
- Mobile menu links already call `setIsDrawerOpen(false)`.
- The shell focus style is already scoped to `.admin-v2` and uses blue focus, not purple.

### Repeated Local UI

- Several admin pages duplicate local CSS for hero blocks, filters, tables, cards, mobile states, and inputs.
- The highest duplication appears in:
  - `src/app/admin/jobs/page.tsx`
  - `src/app/admin/clients/page.tsx`
  - `src/app/admin/agencies/page.tsx`
  - `src/app/admin/travel/page.tsx`
  - `src/app/admin/calendar/page.tsx`
- Older `.panel`, `.grid`, `.table`, `.table-wrap`, `.button`, and `.status` classes still appear in Accounting, Calendar, Requests, Media, and several detail/form pages.
- `aro-glass-card` is used as a newer visual container, but each page redefines filters and tables independently.

### Jobs

- `/admin/jobs` is the strongest current visual reference, but filters are too wide and the table uses a large minimum width.
- The screenshot shows the filter row and table columns being clipped on desktop.
- Models are shown as plain names, even though each job already loads `job_models.model.main_image_path`.
- Existing fallback title is `Trabalho sem título`, which makes old jobs look broken instead of recoverable.
- There is no safe delete action in the Jobs UI or server actions.

### Clients

- `/admin/clients` uses a separate old visual system (`clients-shell`, `clients-filter-panel`, `clients-table-panel`).
- Filters are fully expanded and visually heavier than Jobs/Command Center.
- The table is very wide, with horizontal scroll on desktop and many low-priority contact columns.
- Client identity is text-only; it should use initials/logo-like identity.
- `International Agency` still appears as a client type option. Partner agencies should live in Agencies; legacy records should not be silently migrated.

### Agencies

- `/admin/agencies` is functional, but looks like generic cards with low visual priority.
- Agency cards do not show active season counts, linked model previews, or an obvious CRM hierarchy.
- Detail pages include edit links, but list cards need stronger visual identity and clearer action paths.

### Travel

- `/admin/travel` mixes seasons, trips, flights, filters, and finance-like details in one grid.
- Active seasons are not clearly the default operational view.
- Filters show too many fields at once.
- Season cards need model photos, receiving agency identity, destination, status, documents/contract/return cues, and clear actions.

### Accounting

- `/admin/accounting` still uses generic `.panel`, `.grid`, `.table`, and `.table-wrap`.
- Model rows are text-only despite financial entries already selecting `model.main_image_path`.
- Filters are large and not aligned with the newer Jobs visual language.
- Mobile relies on generic table behavior rather than financial cards.

### Calendar

- `/admin/calendar` has useful data and views, but the month/year picker is too complex:
  - click title;
  - open details panel;
  - choose month;
  - edit year;
  - apply;
  - close.
- VEIN reference confirms a simpler pattern: previous, today, next, title, compact month/year chooser, view tabs, plus button.
- Calendar event rows already have model image URL support and should preserve batched image loading.

### Forms And Details

- Several detail and form pages still use `.panel` or inline padding.
- Cadastro360 already has the complete tabbed model profile and should be preserved.
- Form polish should be limited to shared admin-compatible styling, sticky actions where useful, and mobile-safe spacing.

## Components To Consolidate

Create shared primitives in `src/components/admin/admin-ui.tsx`:

- `AdminPage`
- `AdminPageHeader`
- `AdminToolbar`
- `AdminFilterBar`
- `AdminSearchField`
- `AdminSelect`
- `AdminDateField`
- `AdminSection`
- `AdminDataTable`
- `AdminStatusPill`
- `AdminEntityAvatar`
- `AdminModelIdentity`
- `AdminClientIdentity`
- `AdminAgencyIdentity`
- `AdminEmptyState`
- `AdminStat`
- `AdminTabs`

Create small interaction components only where server components cannot handle local state:

- Jobs action menu and confirm dialog.
- Calendar compact month picker.

## Responsive Strategy

- Desktop: keep tables for dense operational data, but remove fixed page-breaking widths.
- Tablet: reduce visible columns and collapse lower-priority filters into `details`.
- Mobile: render entity rows as cards, keep primary action visible, avoid horizontal page overflow.
- Filters: default to compact search plus primary selects; put secondary filters in `Mais filtros`.
- Visual identity: use model/client/agency avatar components with photo or initials.

## Security And Data

- Do not expose sensitive model, travel, financial, or document fields in broad lists.
- Do not change RLS or buckets.
- Do not add migrations for visual changes.
- Safe Jobs delete must be blocked if financial rows or receipts exist. Existing database restrictions must remain the final guard.

## Completion Criteria

- Jobs no longer clips filters/table on desktop or mobile.
- Jobs, Accounting, Travel, Agencies, and Clients share the same admin visual language.
- Related models show photos or initials using batched image URLs.
- Calendar navigation is simpler and keeps month/week/list behavior.
- Safe deletion exists for simple jobs and blocks financial dependencies.
- No secrets, backups, private screenshots, or migrations are staged.
- `npm install`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and `git diff --check` complete before push.

## Final Pass Status

- `src/components/admin/admin-ui.tsx` added shared admin primitives.
- `src/app/globals.css` now includes an `.admin-v2` compatibility layer for shared buttons, forms, panels, tables, focus states, and new primitives.
- `/admin/jobs` migrated to compact filters, visual model identity, responsive table/cards, intelligent untitled-job fallback, and safe action menu.
- `/admin/calendar/[id]` now exposes the same safe job actions in the event detail.
- `/admin/calendar` month navigation was simplified to previous, today, next, compact month/year chooser, view tabs, and plus action.
- `/admin/clients` migrated away from the old isolated layout to the shared admin page/filter/table pattern.
- `/admin/agencies` now shows agency identity, active season count, and linked model previews when season data exists.
- `/admin/travel` now defaults to `Temporadas` and separates `Temporadas`, `Viagens e voos`, `Documentos pendentes`, `Alertas`, and `Histórico` with URL tabs.
- `/admin/accounting` now uses shared metrics, filters, table, status pills, and model identity with batched image URLs.
- Cadastro360 was not rewritten. It only benefits from the admin-scoped form/button/focus compatibility layer.
- No migration was added.
- Remaining known warnings are pre-existing `<img>` lint warnings and unused Cadastro360 tab helper warnings. They do not fail lint/build.
