# Cyrix Ledger — Design System Reference
> **Source of truth** for all UI tokens, patterns, and components in Cyrix Field Ops.  
> Last updated: July 2026 — Full "Cyrix Ledger" overhaul.

---

## Philosophy

**Trust through transparency. Deliberate friction on high-stakes actions. Dense but calm.**

Inspired by the design philosophy of Ramp, Brex, Navan, and Stripe Dashboard — an original Cyrix design system built for financial-grade field operations. Not a copy, an original.

Three rules guide every decision:
1. **Flat + bordered, not floaty + shadowed** — cards rely on `border: 1px solid var(--line)`, shadows are reserved for floating elements only (dropdowns, modals, toasts).
2. **One confident accent, used sparingly** — `--accent-600 (#4338CA)` is the only primary action color. No five-color button rainbow.
3. **Tabular-mono for numbers** — amounts, claim IDs, dates in tables use `IBM Plex Mono` with `font-variant-numeric: tabular-nums`. This alone is the single biggest "financial-grade" signal.

---

## Color Tokens

### Canvas & Surface
| Token | Value | Usage |
|-------|-------|-------|
| `--canvas` | `#FAFAF9` | Page background (warm off-white, not cold slate) |
| `--surface` | `#FFFFFF` | Card / container background |
| `--surface-sunken` | `#F4F3F1` | Nested panels, table header row, input disabled |

### Ink (Text)
| Token | Value | Usage |
|-------|-------|-------|
| `--ink-900` | `#12151A` | Headings, primary text |
| `--ink-700` | `#3A3F47` | Body text |
| `--ink-500` | `#6B7280` | Secondary / muted text, labels |
| `--ink-300` | `#A9AFB8` | Placeholder, disabled |

### Borders / Lines
| Token | Value | Usage |
|-------|-------|-------|
| `--line` | `#E7E5E1` | Default hairline border (warm gray) |
| `--line-strong` | `#D4D1CB` | Emphasized border, hover state |

### Brand Accent — "Ledger Indigo"
| Token | Value | Usage |
|-------|-------|-------|
| `--accent-50` | `#EEF0FF` | Hover tint, selected row bg |
| `--accent-100` | `#DEE1FF` | Selection highlight |
| `--accent-400` | `#6366F1` | Active nav indicator, sidebar rail |
| `--accent-600` | `#4338CA` | **PRIMARY ACTION** — buttons, active nav, links, focus ring |
| `--accent-700` | `#362FA0` | Hover / pressed |
| `--accent-900` | `#1E1B4B` | Sidebar dark surface, brand mark |

### Status — "Data Ink" (desaturated, not neon)
| Status | Text | Bg | Border |
|--------|------|----|--------|
| Approved | `#0F7A4C` | `#EBF7F1` | `#C9EBDA` |
| Pending | `#B7791F` | `#FCF6EB` | `#F1E1BC` |
| Rejected | `#B3261E` | `#FBEEEC` | `#F0CFC9` |
| Escalated | `#7C3AED` | `#F3EEFD` | `#DECBFA` |

> **Immutable rule:** Status colors must map 1:1 consistently across dashboard, tables, badges, modals, PDF exports. These hex values are locked semantically — never use `green` for rejected or `red` for approved regardless of context.

### Data-Viz Categorical Palette
```
Indigo  #4338CA  — primary series
Green   #0F7A4C  — positive / approved
Amber   #B7791F  — warning / pending
Violet  #7C3AED  — escalated / secondary
Cyan    #0E7490  — info / neutral series
Red     #B3261E  — negative / rejected
```

---

## Typography

### Font Stack
| Role | Font | Fallback |
|------|------|----------|
| Body / UI | `Inter` | `system-ui, sans-serif` |
| Display / Headings / KPI | `Inter Tight` | `Inter, sans-serif` |
| Tabular / Amounts / IDs | `IBM Plex Mono` | `JetBrains Mono, Consolas, monospace` |

### Type Scale
| Class | Size / Line-height | Usage |
|-------|--------------------|-------|
| `text-2xs` | 11px / 14px | Table meta, timestamps, badge labels |
| `text-xs` | 12px / 16px | Captions, secondary labels |
| `text-sm` | 14px / 20px | Body, form labels, button text |
| `text-base` | 16px / 24px | Card titles, modal titles |
| `text-lg` | 20px / 28px | Section headers, page sub-titles |
| `text-2xl` | 28px / 32px | **KPI hero numbers** |
| `text-3xl` | 36px / 40px | Dashboard page-level headline number only |

### Heading Rules
- All `h1`–`h6` use `Inter Tight` with `letter-spacing: -0.015em`
- KPI numbers: `Inter Tight`, `font-size: 28–36px`, `letter-spacing: -0.02em`, `font-variant-numeric: tabular-nums`
- Table amounts: `IBM Plex Mono`, right-aligned, `tabular-nums`

---

## Elevation & Shape

### Border Radius — "Precise, Not Bubbly"
| Token | Value | Usage |
|-------|-------|-------|
| `rounded-sm` | 4px | Focus rings, small chips |
| `rounded-md` | 8px | **Inputs, buttons** |
| `rounded-lg` | 10px | **Cards** ← ceiling for static surfaces |
| `rounded-xl` | 14px | Larger modals |
| `rounded-full` | 9999px | Status pills only |

### Shadow — Reserved for Floating Elements Only
| Token | Value | Usage |
|-------|-------|-------|
| `shadow-none` | none | **Cards, static surfaces** (use border instead) |
| `shadow-xs` | 1px blur | Subtle chrome |
| `shadow-md` | 4px blur | **Dropdowns, modals, toasts** |
| `shadow-lg` | 8px blur | Max — only for command palette, drawer |
| `shadow-focus` | `0 0 0 2px canvas, 0 0 0 4px accent-600` | Focus ring — not a glow |

---

## The Cyrix Visual Signatures

### 1. Status Rail (on claim rows/cards)
A **3px left-edge colored border** matching the claim status — the single most recognizable Cyrix UI pattern.

```css
/* Apply to table rows or claim cards */
.status-rail { border-left: 3px solid transparent; }
.status-rail-approved  { border-left-color: #0F7A4C; }
.status-rail-pending   { border-left-color: #B7791F; }
.status-rail-rejected  { border-left-color: #B3261E; }
.status-rail-escalated { border-left-color: #7C3AED; }
```

### 2. Tabular-Mono Amounts
Right-aligned, IBM Plex Mono, `tabular-nums`. Applied to every monetary column in every table.

```css
.tabular-mono {
  font-family: 'IBM Plex Mono', monospace;
  font-variant-numeric: tabular-nums;
  text-align: right;
}
```

### 3. Outline + Dot Status Badges
Small colored dot + text, 1px border, near-transparent background. Calm at high density.

```html
<span class="badge-status badge-approved">Approved</span>
<span class="badge-status badge-pending">Pending</span>
<span class="badge-status badge-rejected">Rejected</span>
```

---

## Components

### Buttons
| Variant | Class | When to use |
|---------|-------|-------------|
| Primary | `.btn-lte-primary` | Main CTA — one per screen |
| Secondary | `.btn-lte-secondary` | Secondary actions |
| Outline | `.btn-lte-outline` | Tertiary, ghost actions |
| Success | `.btn-lte-success` | Confirm approve |
| Danger | `.btn-lte-danger` | Confirm reject / delete (filled only on confirm step) |
| Warning | `.btn-lte-warning` | Flagging actions |

**Rules:** 40px height desktop, 44px mobile. No gradients. No box-shadow on static buttons. `rounded-md` (8px).

### Cards
```html
<!-- Base flat card -->
<div class="card-lte">...</div>

<!-- With status rail (Cyrix signature) -->
<div class="card-lte card-lte-success">...</div>  <!-- approved green rail -->
<div class="card-lte card-lte-warning">...</div>  <!-- pending amber rail -->
<div class="card-lte card-lte-danger">...</div>   <!-- rejected red rail -->
```

### KPI Stat Cards
```html
<div class="stat-card">
  <div class="stat-card-eyebrow">Total Claims</div>
  <div class="stat-card-number tabular-mono">₹2,41,500</div>
  <div class="stat-card-delta stat-card-delta-up">▲ 12% vs last month</div>
</div>
```

### Skeleton Loading (replaces all spinners)
```html
<div class="skeleton skeleton-number" style="width: 120px;"></div>
<div class="skeleton skeleton-text" style="width: 80%;"></div>
<div class="skeleton skeleton-text" style="width: 60%;"></div>
```

### Form Inputs
```html
<label class="label-lte">Employee ID</label>
<input type="text" class="input-lte" placeholder="e.g. E001" />
```
Focus ring: `2px solid #4338CA`, offset `2px`. No glow/shadow.

---

## Navigation

### Sidebar
- Background: `--accent-900` (`#1E1B4B`) dark indigo-navy
- Inactive labels: `rgba(255,255,255,0.60)`
- Active item: `rgba(99,102,241,0.20)` bg + `3px left accent-400 rail` + white text
- Collapsible to 48px icon-only rail on desktop

```html
<nav class="sidebar-ledger">
  <a class="sidebar-ledger-item sidebar-ledger-item-active">Dashboard</a>
  <a class="sidebar-ledger-item">Expenses</a>
</nav>
```

### Top Bar (Navbar)
- Thin 1px `--line` bottom border (no heavy shadow)
- Right-aligned: notifications bell (dot badge, not red circle) + avatar (initials only)

---

## Auth Pages

### Split-Screen Login
```html
<div class="auth-split-screen">
  <!-- Left: Brand panel on accent-900 -->
  <div class="auth-split-brand">
    <h1>Cyrix Field Ops</h1>
    <p>Enterprise expense management for field engineers</p>
  </div>
  <!-- Right: Form on surface white -->
  <div class="auth-split-form">
    <!-- LoginForm here -->
  </div>
</div>
```
Mobile: brand panel hides, form takes full screen.

---

## Animation

| Class | Duration | Usage |
|-------|----------|-------|
| `animate-fade-in-up` | 150ms | Page / card entrance |
| `animate-scale-up` | 150ms | Modal open |
| `animate-slide-in-right` | 150ms | Toast / notification |
| `animate-slide-in-up` | 220ms | Bottom sheet (mobile) |
| `animate-count-up` | 300ms | KPI number on first mount |
| `animate-confirm-pulse` | 200ms | Approve/Reject button confirm state |
| `.skeleton` (shimmer) | 1.6s loop | Loading states (replaces all spinners) |

**`prefers-reduced-motion`:** All animations disabled automatically via `@media (prefers-reduced-motion: reduce)` in globals.css.

---

## AntD v5 Theme Mapping

| AntD Token | Cyrix Value |
|------------|-------------|
| `colorPrimary` | `#4338CA` (accent-600) |
| `colorBgLayout` | `#FAFAF9` (canvas) |
| `colorBgContainer` | `#FFFFFF` (surface) |
| `colorBorder` | `#E7E5E1` (line) |
| `colorText` | `#12151A` (ink-900) |
| `colorSuccess` | `#0F7A4C` (approved) |
| `colorWarning` | `#B7791F` (pending) |
| `colorError` | `#B3261E` (rejected) |
| `borderRadius` | `8` (rounded-md) |
| `fontSize` | `13` |

---

## Page Pass Order (Implementation)

1. ✅ Design tokens — `tailwind.config.js`, `themeConfig.ts`, `globals.css`, `DESIGN_SYSTEM.md`
2. ⬜ Shell — `Navbar.tsx`, `Sidebar.tsx`, `DashboardLayout.tsx`
3. ⬜ Auth — `LoginPage.tsx`, `ForgotPassword.tsx`, `UnlockAccount.tsx`
4. ⬜ Dashboard — `DashboardPage.tsx`, `StatCard.tsx`, charts
5. ⬜ Expense flow — full redesign (calc logic inside 🔒 blocks unchanged)
6. ⬜ Approvals — highest-stakes screen, most deliberate friction
7. ⬜ Admin — full redesign (calc logic inside 🔒 blocks unchanged)
8. ⬜ Reports / Analytics
9. ⬜ Profile, Settings, misc pages
10. ⬜ DesignSystemPage — live style-guide
