# ARO Admin Design System V2

## Identity

- Keep the ARO Command Center identity.
- Use the current ARO blue, Liquid Glass panels, institutional typography, and dark/light/system theme.
- Do not introduce VEIN wording, colors, or logo assets.

## Visual Tokens

- Admin styles are scoped under `.admin-v2`.
- Panels use translucent deep blue backgrounds, subtle blue borders, blur, and restrained depth.
- Focus states use blue rings and blue borders.
- Light mode uses pale blue/gelo surfaces, navy text, and the same hierarchy.

## Shared Components

The reusable admin primitives live in `src/components/admin/admin-ui.tsx`.

- `AdminPage`: page rhythm and safe width.
- `AdminPageHeader`: eyebrow, title, description, and primary actions.
- `AdminToolbar`: compact filter/action container.
- `AdminFilterBar`: responsive filter layout.
- `AdminSearchField`, `AdminSelectField`, `AdminDateField`, `AdminTextField`: theme-aware controls.
- `AdminMoreFilters`: collapses secondary filters.
- `AdminSection`: glass content section with optional header.
- `AdminDataTable`: desktop table, mobile card rows.
- `AdminEntityAvatar`: photo or initials.
- `AdminModelIdentity`, `AdminClientIdentity`, `AdminAgencyIdentity`: visual entity rows.
- `AdminStatusPill`: consistent status tokens.
- `AdminEmptyState`: quiet empty state.
- `AdminStat`: compact metric cards.
- `AdminTabs`: URL-driven section tabs.

## Page Pattern

1. Eyebrow.
2. Strong title.
3. Short operational description.
4. Primary actions.
5. Optional compact metrics.
6. Compact filters.
7. Main content as table on desktop and cards on mobile.

## Tables And Cards

- Desktop tables should not force page-level horizontal overflow.
- Low-priority filters go into `Mais filtros`.
- On mobile, rows become cards with `data-label` labels.
- Avoid nested panels and pure white cards.

## Entity Identity

- If a model is related, show photo, stage name, and useful secondary context.
- Signed image URLs must be generated in batch before rendering.
- If there is no image, show initials.
- Clients and agencies use initials unless a future logo URL exists.

## Jobs

- Jobs use compact primary filters, secondary date/client filters, visual model identities, and action menus.
- Old untitled jobs use an intelligent fallback while still indicating the title is missing.
- Permanent deletion is only for simple records with no financial dependency.

## Calendar

- Calendar navigation follows the simpler VEIN-inspired interaction:
  previous, today, next, month/year title, direct compact chooser, view tabs, and plus action.
- ARO identity and colors remain unchanged.

## Travel

- Travel defaults to `Temporadas`.
- The top hierarchy separates seasons, trips/flights, pending documents, alerts, and history.
- Season cards prioritize model, destination, receiving agency, status, dates, and operational alerts.

## Accounting

- Accounting uses the same header, metrics, filters, status pills, and model identity components.
- Currency totals are never mixed.

## Accessibility

- Use visible focus.
- Icon-only actions require `aria-label`.
- Mobile cards keep readable labels.
- Dialogs must be accessible and avoid `window.confirm`.

## Future Work

- Logo upload for agencies and clients.
- Full pagination server-side for large datasets.
- More visual regression coverage with authenticated Playwright sessions.

