# Twibbonize Design System

> A semantic guide to the visual language of `@twibbonize/ui`. This file is the source of truth for *why* the system looks and behaves the way it does. Tokens describe *what* to use, components describe *where*, but the rationale here lets an agent make the right call when it hits a situation the rules never covered.

---

## 1. Visual theme and atmosphere

Twibbonize is a campaign and creator platform. The interface embodies **"warm clarity"** — friendly enough to feel human, structured enough to feel reliable. Every surface leans on a single brand pivot (turquoise) against soft, near-white neutrals. Color is rarely decorative; it carries meaning (primary action, success, danger, attention).

The aesthetic borrows from social-product design (rounded forms, generous touch targets, soft shadows) but is engineered like a dashboard (semantic tokens, predictable spacing, no hex values in components). The result is an interface that feels approachable on a creator's phone and trustworthy on an admin's desktop.

Three principles shape every decision:

- **Soft, not sharp.** Rounded corners (10px+), pill-shaped controls, low-contrast borders. Edges are deliberately blurred to keep the UI inviting.
- **Brand color is for action, not text.** Turquoise marks what the user can *do* (buttons, links, focus rings). It is never used as a body text color, because brand-as-text reads loud and dilutes the hierarchy.
- **Density follows context.** Forms breathe. Tables compress. The same component can shift size (`sm` / `md` / `lg`) based on where it lives.

---

## 2. Color palette and roles

All colors are exposed as CSS custom properties. Components must reference them through semantic tokens (`bg-primary`, `text-foreground`, `border-border`) — **never hardcode hex**. Dark mode flips automatically when the `.dark` class is applied to `<html>`.

### Brand scales (light mode)

| Scale | Value | Used for |
|---|---|---|
| `--turquoise-50` | `#EDF8F8` | Primary subtle (bg behind a primary chip) |
| `--turquoise-100` | `#E8FBF9` | Hover backgrounds on primary surfaces |
| `--turquoise-200` | `#A2F0E6` | Decorative tints |
| `--turquoise-300` | `#5CE5D4` | Focus ring (`--ring`) |
| `--turquoise-400` | `#16DAC1` | **Brand primary** — buttons, switches, indicators |
| `--turquoise-500` | `#14C4AE` | Primary hover (slight darkening on interaction) |

Why turquoise: it scans as fresh and optimistic, distinguishes Twibbonize from the sea of blue-led social products, and has enough chroma to function on both white and dark backgrounds without losing identity.

### Neutrals (light mode)

| Token | Value | Role |
|---|---|---|
| `--neutral-0` | `#FFFFFF` | Page background, cards |
| `--neutral-100` | `#F0F7F7` | Subtle surface (toolbar, hover row) |
| `--neutral-200` | `#DEE8E8` | Border default, muted surface |
| `--neutral-300` | `#8D8D8D` | Muted foreground (secondary text), strong border |
| `--neutral-400` | `#5F5F5F` | Subtle foreground (tertiary text) |
| `--neutral-500` | `#1B1B1B` | Foreground (body text, headings) |

Note: the neutrals carry a faint cool tint (cyan-leaning). This is intentional — it pairs with turquoise without competing. Do not mix in warm grays; the surfaces will feel dirty.

### Semantic colors

| Role | Light value | Dark value | When to use |
|---|---|---|---|
| `--background` | `#FFFFFF` | `#1B1B1B` | Page bg |
| `--background-subtle` | `#F0F7F7` | `#2A2A2A` | Section bg, hover row |
| `--background-muted` | `#DEE8E8` | `#3F3F3F` | Disabled fill, divider band |
| `--foreground` | `#1B1B1B` | `#FFFFFF` | Body text |
| `--foreground-muted` | `#8D8D8D` | `#8D8D8D` | Secondary text, captions |
| `--foreground-subtle` | `#5F5F5F` | `#F0F7F7` | Tertiary text, helper copy |
| `--primary` | `#16DAC1` | `#2FC6B3` | Primary button, switch on, link underline color |
| `--primary-hover` | `#14C4AE` | `#0F9987` | Primary hover |
| `--primary-subtle` | `#EDF8F8` | (token) | Selected nav row, primary chip bg |
| `--accent` | `#FFEF5F` | `#E9DB63` | Highlight pills, "new" badges |
| `--accent-hover` | `#E6D756` | `#D2C559` | Accent hover |
| `--accent-subtle` | `#FFF48F` | `#EDE282` | Accent surface |
| `--warning` | `#FFAF3F` | (token) | Caution states (rate limits, soft warnings) |
| `--destructive` | `#E93F3F` | `#C74949` | Delete, irreversible actions, error states |
| `--destructive-hover` | `#E40F0F` | `#B91C1C` | Destructive hover |
| `--destructive-subtle` | `#FCE7E7` | `#F8E8E8` | Error field background |
| `--border` | `#DEE8E8` | `#3F3F3F` | Default border |
| `--border-strong` | `#8D8D8D` | `#E4E4E4` | Emphasis border (radio outline, input focus on dark) |
| `--ring` | `#5CE5D4` | `#2FC6B3` | Focus ring (3px, 10% opacity wash) |

### Color rules

- **Brand color is action, not text.** Use `text-foreground` (with `underline` for links), never `text-primary`.
- **Borders carry hierarchy in light mode; surfaces carry it in dark mode.** Light mode separates by 1px borders on near-white backgrounds. Dark mode lifts cards to `--neutral-400` instead of relying on borders.
- **Subtle variants exist for a reason.** A "primary chip" is `bg-primary-subtle text-foreground` — not `bg-primary text-primary-foreground`. Reserve full-saturation primary for things you want a user to click.

---

## 3. Typography rules

**Font family**: Manrope only, weights 400/500/600/700, loaded from Google Fonts. No other typeface is permitted — including Geist, Inter, or Plus Jakarta Sans.

Why Manrope: rounded but not playful; works at 12px in tables and 48px in hero sections without re-tuning; covers Latin-extended scripts well, which matters for a multilingual creator platform.

### Title scale (custom utilities)

These utilities set `font-size` and `line-height` only — weight is always a separate Tailwind class.

| Class | Size | Line-height | Use for |
|---|---|---|---|
| `text-title-h1` | 48px | 56px | Hero headline, page-defining title |
| `text-title-h2` | 40px | 44px | Section opener |
| `text-title-h3` | 32px | 44px | Sub-section title |
| `text-title-h4` | 24px | 34px | Card title, modal title |
| `text-subheading-20` | 20px | 28px | Prominent label, large list item |
| `text-subheading-18` | 18px | 26px | Form group title, secondary heading |

### Body scale (Tailwind native, with one override)

| Class | Size | Line-height | Use for |
|---|---|---|---|
| `text-base` | 16px | 24px (Tailwind default) | Body copy, input text in `md` size |
| `text-sm` | 14px | **18px (overridden)** | Compact UI text — buttons, labels, tooltips, table cells |
| `text-xs` | 12px | 16px | Helper text, metadata, badges |

The `text-sm` line-height is deliberately tightened from Tailwind's default 20px to 18px. Reason: at 14px, 20px line-height makes vertical rhythm in dense UI (forms, dropdowns, tables) feel loose. 18px keeps rows compact while still readable.

### Weight rules

- `font-bold` (700) — title-h1 only, sparingly. Reserved for moments that need to *anchor* the page.
- `font-semibold` (600) — all buttons, all titles h2–h4, subheadings, emphasis in body.
- `font-medium` (500) — most interactive text (menu items, tabs, table headers).
- `font-normal` (400, default) — body copy, helper text, descriptions.

Default to weight 500 or 600 for any UI surface; reserve 400 for prose.

### Typography don'ts

- Don't use brand color as text. Use `text-foreground` and add `underline` for links.
- Don't use a custom title class with `font-normal` — they're designed to read as semibold.
- Don't apply letter-spacing manually. Manrope is metrics-tuned; tracking adjustments will fight the font.
- Don't go below 12px. Captions stop being legible.

---

## 4. Component styles

All are built on shadcn/ui patterns with Radix primitives, styled via `cva` (class-variance-authority), and merged with a `cn()` class utility. Icons come from `@remixicon/react`.

### Button

**Variants**: `primary` (default), `accent`, `inverse`, `secondary`, `ghost`, `destructive`, `destructive-outline`, `link`.
**Sizes**: `xs`, `sm`, `md` (default), `lg`, `xl`, plus square `icon-{xs|sm|md|lg|xl}`.
**Radius**: `pill` (default, `rounded-full`) or `rounded` (`rounded-lg`).

- All buttons are `font-semibold`. Text size scales with the size prop (12px at `xs` → 18px at `xl`).
- Default shape is **pill**. Square-cornered buttons are reserved for cases where a button sits inside an input group or a tightly-gridded layout.
- Hover darkens via the `*-hover` token (e.g., `--primary-hover`). No opacity tricks.
- Focus is a 3px ring at 10% primary (`ring-primary/10`) with 1px primary border — never the default browser outline.
- Disabled is `opacity-50 pointer-events-none`. We use opacity, not a gray tint, so the button retains its shape signature when disabled.

### Input / Textarea

**Sizes**: `sm` (h-10, 14px text) and `md` (h-52, 16px text, default).
**Radius**: `rounded` (10px @ sm, 14px @ md) or `pill` (`rounded-full` for inputs, `rounded-3xl` for textareas).

- Border is `border-border` at rest, `border-primary` on focus, `border-error-400` when invalid.
- Focus adds a 3px ring at 10% primary (`ring-primary/10`). Error focus ring is the destructive variant.
- Placeholder is `text-foreground-muted`. Don't use brand color or italic.
- Inputs support `InputGroup` composition (Text, Icon, Input, Button slots) for prefix/suffix patterns like search fields and currency inputs.
- Textarea auto-grows; do not set a fixed height unless explicitly required.

### Dialog / Sheet

**Dialog sizes**: `sm` (max-w-sm), `md` (max-w-[512px], default), `lg` (max-w-[720px]).
- `rounded-xl` corners (14px) — softer than the rest of the system to feel like a discrete surface.
- Overlay: `bg-black/10 backdrop-blur-xs`. The blur is intentional — full opacity overlays make the page feel frozen; blur lets context bleed through.
- Animations: `zoom-in-95 fade-in` open, mirrored close.
- Always include `DialogTitle` (visually-hidden if needed) for screen readers.

### Select / Combobox

- Triggers default to `rounded-full` to match the button system.
- Sizes match input: `sm` / `md` / `lg`.
- Combobox supports single, multiple, clearable, and **chips mode** (selected values render inline as removable chips inside the trigger).
- Content panel: `rounded-lg`, `shadow-md`, max-height `300px`, `scrollbar-thin`.

### Dropdown Menu

- Min-width 180px so single-word items don't look cramped.
- Items: `px-2 py-2`, `text-sm font-medium`, `rounded-lg`, hover background `bg-background-subtle`.
- Destructive items use `text-destructive` and `hover:bg-destructive-subtle`. Reserve for delete/remove actions.

### Switch / Radio Group / Checkbox

- Switch container `h-6 w-11`, thumb `size-5` with `shadow-sm`. On state uses `bg-primary`.
- Radio item `size-5`, border `border-border-strong` at rest, `border-primary` checked. Indicator is a `size-[15px]` filled circle in primary.
- Always pair with a `<Label>` and use `Field` for layout when in a form.

### Tabs

Three variants for three different jobs:
- **`line`** — default. Border-bottom with an animated underline. Use for top-level page navigation inside a section.
- **`pills`** — `bg-background-subtle p-1 rounded-full` with a sliding active pill. Use inside cards or modals where line tabs would feel heavy.
- **`chips`** — wrapping, state-colored, individually rounded. Use for filters where multiple states might coexist visually.

### Tooltip

- `px-3 py-2 text-sm font-medium rounded-lg shadow-sm max-w-xs`
- Arrow is `size-2.5` filled with `popover` background.
- Use for keyboard hints, icon clarification, and constraint explanations. Don't use as primary copy delivery.

### Field

A layout component for form rows. Orientations: `vertical` (default), `horizontal`, `responsive` (vertical on mobile, horizontal on desktop via container queries). Always wrap inputs in a `Field` for consistent label/description/error spacing.

### Sidebar

A compound component with its own context — controls collapse state, mobile overlay, and rail width. Has dedicated tokens (`--sidebar`, `--sidebar-foreground`, `--sidebar-accent`, etc.) so it can theme independently from the page background. Use for primary app navigation.

---

## 5. Layout principles

### Spacing

Tailwind's default 4px-base scale. No custom additions.

```
0.5 → 2px    3 → 12px    8  → 32px
1   → 4px    4 → 16px    10 → 40px
1.5 → 6px    5 → 20px    12 → 48px
2   → 8px    6 → 24px    16 → 64px
2.5 → 10px   7 → 28px    20 → 80px
```

- Component internal padding: 8–24px (`p-2` to `p-6`).
- Stack gap inside a card: `gap-4` (16px) for related fields, `gap-6` (24px) for groups.
- Section gap on a page: `gap-8` to `gap-12` (32–48px).
- Page outer padding: `p-4` mobile, `p-6` to `p-8` desktop.

### Border radius

The radius scale is built from a base of `--radius` (`0.625rem` = 10px). All other values are calculated multiples.

| Token | Calc | Value | Default use |
|---|---|---|---|
| `rounded-sm` | `--radius * 0.6` | 6px | Badges, small chips |
| `rounded-md` | `--radius * 0.8` | 8px | Inline elements, small inputs |
| `rounded-lg` | `--radius * 1.0` | 10px | Buttons (square mode), inputs (sm), dropdown items |
| `rounded-xl` | `--radius * 1.4` | 14px | Cards, dialogs, inputs (md) |
| `rounded-2xl` | `--radius * 1.8` | 18px | Modals, large media cards |
| `rounded-3xl` | `--radius * 2.2` | 22px | Sheet, large textarea pill |
| `rounded-4xl` | `--radius * 2.6` | 26px | Hero panels |
| `rounded-full` | — | pill | Buttons, switches, pill tabs, avatars |

Rule: **softer is the default**. Never go below `rounded-sm` for an interactive element, and prefer `rounded-full` over `rounded-lg` for buttons unless context says otherwise.

### Container widths

No fixed max-width is enforced by the design system; pages decide. Common patterns:
- Form/settings page: `max-w-2xl` (672px)
- Content page: `max-w-4xl` (896px) to `max-w-6xl` (1152px)
- App shell: full width with sidebar

---

## 6. Depth and elevation

Shadows are intentionally soft and **scale with mode**. Light mode uses near-imperceptible shadows that just suggest separation; dark mode pumps opacity so cards remain visible against `#1B1B1B`.

| Token | Tailwind | Light | Dark | Use for |
|---|---|---|---|---|
| `--shadow-button` | `shadow-sm` | `0 4px 16px rgba(0,0,0,0.08)` | `0 4px 16px rgba(0,0,0,0.40)` | Floating buttons, switch thumb |
| `--shadow-card-light` | `shadow-md` | `0 8px 16px rgba(93,100,99,0.04)` | `0 8px 16px rgba(0,0,0,0.25)` | Card resting state |
| `--shadow-card-bold` | `shadow-lg` | `0 14px 24px rgba(93,100,99,0.04)` | `0 14px 24px rgba(0,0,0,0.35)` | Hover/lifted cards, popovers |
| `--shadow-tab-bar` | `shadow-up` | `0 -4px 64px rgba(0,0,0,0.10)` | `0 -4px 64px rgba(0,0,0,0.50)` | Bottom-anchored bars (mobile tab bar, sticky CTA) |

Why this is unusual: the light-mode shadows are extremely subtle (4% opacity, cool gray base `rgba(93, 100, 99)`). That's deliberate. In light mode, cards mostly separate via 1px borders; the shadow is a whisper, not a thunk. Dark mode loses borders as a separator (they'd be invisible), so shadows pick up the slack.

### Elevation order (low → high)

1. **Page** — no shadow, just `bg-background`.
2. **Card resting** — `shadow-md` + 1px border (light mode) or just card bg shift (dark mode).
3. **Card hover / dropdown** — `shadow-lg`.
4. **Modal / Dialog** — `shadow-lg` + overlay + backdrop blur.
5. **Toast / floating action** — `shadow-up` from below or `shadow-lg` floating.

---

## 7. Do's and don'ts

### Do

- **Use semantic tokens** (`bg-primary`, `text-foreground`, `border-border`). They handle dark mode for free.
- **Default to pill buttons.** They are the system's signature shape.
- **Use the `cn()` class-merging utility** to combine Tailwind classes. It dedupes conflicts so the last class wins predictably.
- **Use the typography scale** (`text-title-h1` through `text-subheading-18` for titles, `text-base` / `text-sm` / `text-xs` for body) — never raw font-size values.
- **Pair labels and inputs through `Field`.** It encodes spacing, error states, and orientation rules.
- **Prefer existing components from `@twibbonize/ui`** before writing new ones.
- **Use opacity for disabled states**, not a gray tint. The component should still read as itself, just dimmed.

### Don't

- **Don't hardcode hex values** in components. If a color isn't in the token system, add it before using it.
- **Don't use brand color as text color.** Underline + foreground for links.
- **Don't use any font other than Manrope.** No Inter, no Geist, no Plus Jakarta Sans.
- **Don't write conditional dark-mode logic** in components (`isDark ? '#fff' : '#000'`). Use tokens; the `.dark` class on `<html>` does the work.
- **Don't apply `font-normal` to titles.** The title classes assume semibold weight as their reading.
- **Don't use `shadow-xl` or above for cards.** The system caps at `shadow-lg`. Heavier shadows feel cheap.
- **Don't mix warm grays into the neutral palette.** The neutrals are slightly cool; warm-gray contamination makes surfaces look dirty.
- **Don't add custom border-radius values.** The 6/8/10/14/18/22/26/full scale covers everything.
- **Don't introduce new brand colors.** Turquoise is the only brand pivot. Yellow accent is for highlight, not brand.
- **Don't use `rounded-sm` on a button.** Buttons are pills or `rounded-lg`, never tighter.

---

## 8. Responsive behavior

The design system follows Tailwind's default breakpoints. There is no single "mobile-first" rule baked into components; instead, components expose size variants (`sm` / `md` / `lg`) and orientation props (e.g., `Field` with `responsive` orientation that uses container queries).

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | `< 640px` | Single column, sidebar collapses to overlay, sheets replace dialogs for forms |
| `sm` | `≥ 640px` | Multi-column lists begin |
| `md` | `≥ 768px` | Sidebars start to peek, forms can go horizontal |
| `lg` | `≥ 1024px` | Persistent sidebar, full desktop layout |
| `xl` | `≥ 1280px` | Wider content max-widths |
| `2xl` | `≥ 1536px` | Reserved for very wide dashboards |

### Touch and accessibility

- Touch target minimum: **44×44px**. The `md` and `lg` button/input sizes meet this; `sm` and `xs` do not — reserve them for desktop-dense UI.
- Don't go below `text-xs` (12px) on any breakpoint. Even on mobile.
- Focus rings (`ring-3 ring-primary/10`) must remain visible. Don't disable `:focus-visible`.
- Color is never the only signal. Errors carry an icon and text; selected items carry a check, not only a color shift.

### Responsive patterns

- **Field** with `responsive` orientation uses `@container` queries to switch between vertical (mobile) and horizontal (desktop) layout. Prefer this over media queries when laying out forms.
- **Dialog → Sheet** swap on mobile is common for forms with more than 3 fields. Use the `Sheet` component directly when the content is form-like.
- **Sidebar** auto-collapses to an overlay on mobile via its built-in context. Don't reimplement this.

---

## 9. Agent prompt guide

Quick reference for an agent generating UI from a brief.

### Quick palette

```
Brand:        primary  #16DAC1   (dark: #2FC6B3)
Backgrounds:  bg       #FFFFFF   (dark: #1B1B1B)
              subtle   #F0F7F7   (dark: #2A2A2A)
Text:         primary  #1B1B1B   (dark: #FFFFFF)
              muted    #8D8D8D
Border:       default  #DEE8E8   (dark: #3F3F3F)
Destructive:  danger   #E93F3F
Accent:       yellow   #FFEF5F
Focus ring:   #5CE5D4 at 10% wash + 3px
Font:         Manrope, weights 400/500/600/700
```

### Default decisions when the brief is silent

- Button shape: **pill**.
- Button size: **`md`** for primary CTA, **`sm`** in toolbars, **`lg`** for hero / mobile sticky CTAs.
- Input size: **`md`** in forms, **`sm`** in inline filters/toolbars.
- Card radius: **`rounded-xl`** (14px).
- Card border: **1px `border-border`** in light mode, raise via `bg-card` in dark mode.
- Card padding: **`p-6`** (24px).
- Section gap: **`gap-6`** to **`gap-8`**.

### Ready-to-use prompts

- **"Create a settings page"** → Use `Sidebar` on desktop. Group settings into sections, each with `text-subheading-18 font-semibold` title, `text-sm text-foreground-muted` description, and `Field` rows with `responsive` orientation. Save action is a `primary` `md` pill button bottom-right.

- **"Build a form"** → Wrap each row in `Field`. Inputs at `md` size with `rounded` (not pill) so they read as form fields. Error state via `FieldError`. Submit button: `primary md pill`, full-width on mobile.

- **"Build a list/feed item"** → `bg-card border-border rounded-xl p-4` row, `gap-3`. Title at `text-base font-semibold`, meta at `text-sm text-foreground-muted`. Hover: `hover:bg-background-subtle`.

- **"Build a confirm-delete dialog"** → `Dialog` size `sm`. Title in `text-title-h4 font-semibold`. Body `text-sm text-foreground-muted`. Footer: `ghost` cancel + `destructive` confirm, both `md`. Never auto-focus the destructive button.

- **"Build a creator profile header"** → `Avatar` size `2xl` or `3xl`, name in `text-title-h3 font-bold`, handle in `text-base text-foreground-muted`. Action: `primary md pill` follow button.

- **"Build a filter bar"** → `Tabs` variant `chips` for filter categories, `Combobox` (chips mode) for multi-select, `sm` sizes throughout. Reset action as a `ghost sm` button at the right.

### Things an agent should refuse silently

- A request to change the brand color → keep turquoise.
- A request to use a different font → keep Manrope.
- A request to color body text in primary → use `text-foreground` + `underline` for links instead.
- A request for hard-edged shadows or heavy elevation → cap at `shadow-lg`.
- A request to mix warm grays → keep the cool-tinted neutrals.

---

## Versioning

This document tracks the system at **`@twibbonize/ui` v4.0.0**. When the system evolves — a new component, a token rename, a shifted radius — update this file in the same PR. The token table, component list, and rationale must stay in sync with the code, or this file becomes a lie.
