# 14 — UI Components (shadcn/ui)

**Applies to:** all frontend work (`03`–`11`). **Depends on:** `00` (Tailwind + shadcn/ui).

## Principle
The entire UI is built with **shadcn/ui** (Radix primitives + Tailwind) for a clean,
consistent, accessible layout. **Do not hand-roll** buttons, inputs, dialogs, dropdowns,
tabs, toasts, etc. — generate the shadcn component and compose/extend it. Custom feature
components wrap shadcn primitives, never replace them.

> Rule: if shadcn has a component for it, use shadcn. Only build bespoke components for
> domain UI that shadcn doesn't cover (e.g. the composer media dropzone, the calendar grid,
> the account-avatar selector) — and build those out of shadcn primitives + Tailwind.

## Setup (`00` foundation)
```bash
npx shadcn@latest init          # style: new-york; base color: neutral; CSS variables: yes
npx shadcn@latest add button input textarea label card dialog dropdown-menu \
  tabs avatar badge switch checkbox select calendar popover sonner tooltip \
  separator skeleton sheet form table scroll-area progress alert
```
- Components land in `src/components/ui/*` (owned, editable code — not a dependency).
- Use the **Form** component (`react-hook-form` + `zod` resolver) so client validation reuses
  the shared Zod schemas from `12`/`src/lib/schemas`.
- Use **sonner** for toasts (success/error feedback on every mutation).
- Icons: **lucide-react** (ships with shadcn).

## Design tokens (match the design system, see `../README.md` + `../../Ref Images/`)
Set CSS variables in `globals.css` so shadcn picks them up. Primary = green; surfaces =
light gray; cards = white.
```css
:root {
  --primary: 142 71% 45%;          /* green ~#16a34a / #22c55e family */
  --primary-foreground: 0 0% 100%;
  --background: 0 0% 100%;
  --muted: 220 14% 96%;            /* light gray surfaces #f3f4f6 */
  --border: 220 13% 91%;
  --radius: 0.625rem;              /* rounded, friendly */
}
```
- Status colors (badges/chips): posted = green, scheduled = blue, draft = amber, failed = red.
  Define as Tailwind classes/variants used by `StatusBadge`.

## Per-screen component map
| Screen / doc | shadcn primitives used |
|---|---|
| **App shell / sidebar** (`04`) | `sheet` (mobile drawer), `dropdown-menu` (workspace + account menu), `avatar`, `button`, `separator`, `tooltip`, `scroll-area` |
| **Auth** (`03`) | `card`, `form`, `input`, `label`, `button`, `sonner` |
| **Connections** (`05`) | `card`, `button`, `avatar`, `badge`, `dialog` (IG method modal), `dropdown-menu` (filter), `switch` (Show IDs), `alert` (limit/upgrade) |
| **Composer** (`06`) | `card`, `textarea` (+ custom char-ring), `tabs` (platform captions), `dropdown-menu` (Past Captions/Processing), `switch` (schedule toggle, Remember), `popover`+`calendar` (date), `select` (time), `badge`; **custom**: media dropzone, account-avatar selector |
| **Posts lists** (`07`) | `card`, `badge` (StatusBadge), `select`/`dropdown-menu` (filters), `table` (optional dense view), `skeleton` (loading) |
| **Calendar** (`07`) | `button`, `tabs` (Month/Week), `popover`, `tooltip`; **custom**: month/week grid + post chips |
| **Publishing flow** (`09`) | `card`, `progress`/spinner, `badge`, `button` (Retry), `alert` |
| **Settings / Queue** (`11`) | `tabs` (Settings·Queue·Billing·Plans), `card`, `form`, `input`, `switch`, `select`, `checkbox` (queue grid days), `button` |
| **Billing / Plans** (`10`) | `card`, `badge` (Trial), `switch`/`tabs` (Monthly/Yearly), `button`, `alert` (annual savings) |
| **Empty states / errors** (all) | `card`, `alert`, `button`, `skeleton` |

## Conventions
- One reusable `StatusBadge` component (maps PostStatus/TargetStatus → colored `badge`).
- All forms = shadcn `Form` + RHF + Zod; show inline field errors; toast on submit result.
- All destructive actions (disconnect, delete post, cancel subscription) use an
  `AlertDialog` confirm.
- Loading = `skeleton`; never a bare spinner for content areas (spinner only for the publish
  progress, `09`).
- Keep layout clean: generous spacing, `--muted` page background, white `card` surfaces,
  green primary CTAs — mirror `../../Ref Images/app-*.png`.
- Responsive: sidebar collapses to a `sheet` drawer on small screens.
- Accessibility comes from Radix; preserve labels, keyboard nav, and focus rings.

## Acceptance criteria
- `src/components/ui/*` is populated by shadcn; feature components import from it.
- No raw `<button>`/`<input>`/custom modal where a shadcn equivalent exists.
- Theme tokens produce the green-on-light-gray look matching the reference screenshots.
- Forms validate with the shared Zod schemas and surface inline errors + toasts.

## Verification
1. Grep for `<button` / `<dialog` / `<input` in `src/app` and `src/components/{feature}` →
   should be near-zero (only inside `components/ui`).
2. Visual pass: each implemented screen matches the corresponding `Ref Images/app-*.png`
   layout/spacing and the green/light-gray palette.
3. Tab through a form (e.g. signup) → focus rings + labels + error messaging work.
