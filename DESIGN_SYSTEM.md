# 🎨 Cyrix Field Ops - Design System Documentation

## Overview
This document defines the single authoritative design system for the **Cyrix Field Ops Web Application**. It unifies **Tailwind CSS**, **Ant Design v5 (`themeConfig.ts`)**, and custom component styling under a TailAdmin-inspired aesthetic benchmark.

---

## 🎨 1. Color Palette & Tokens

### Primary Action Color Scale (Royal Blue)
Used for primary buttons, active links, tab indicators, focus rings, and active navigation states.
- **`primary-50`** (`#EFF6FF`): Soft tint background / active item background.
- **`primary-100`** (`#DBEAFE`): Light accent border / badge background.
- **`primary-500`** (`#3B82F6`): Mid-tone highlight.
- **`primary-600`** (`#2563EB`) **[PRIMARY ACTION TOKEN]**: Main button background, primary icons, active tab text.
- **`primary-700`** (`#1D4ED8`): Hover state for primary buttons & links.
- **`primary-900`** (`#002B5E`) **[BRAND NAVY]**: Brand headers, deep dark accents, contrast sidebar elements.

### Brand Navy Surface & Accent Scale
- **`navy-50`** (`#F0F4F9`): Soft navy tinted card surface.
- **`navy-900`** (`#002B5E`): Header branding bar background, dark contrast badges.

### Immutable Claim Status Semantic Palette
These colors must remain 100% consistent across every dashboard, card, table, badge, modal, export, and PDF preview for expense claim statuses.
- **Approved**:
  - Main text/badge: `#16A34A` (`emerald-600` / `success`)
  - Background tint: `#F0FDF4` (`emerald-50`)
  - Border tint: `#BBF7D0` (`emerald-200`)
- **Pending**:
  - Main text/badge: `#D97706` (`amber-600` / `warning`)
  - Background tint: `#FFFBEB` (`amber-50`)
  - Border tint: `#FDE68A` (`amber-200`)
- **Rejected**:
  - Main text/badge: `#DC2626` (`red-600` / `error`)
  - Background tint: `#FEF2F2` (`red-50`)
  - Border tint: `#FECACA` (`red-200`)

---

## 📐 2. Typography & Spacing Rhythm

### Font Family
- **Sans**: `Inter`, `Plus Jakarta Sans`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Roboto`, `sans-serif`

### Type Hierarchy
- `text-xs` (12px / line-height 16px): Micro-labels, table metadata, badge text, caption text.
- `text-sm` (14px / line-height 20px): Form labels, body text, table cell data, button text.
- `text-base` (16px / line-height 24px): Card headers, modal titles, section titles.
- `text-lg` (18px / line-height 28px): Main page title, secondary metric numbers.
- `text-xl` (20px / line-height 28px): Hero section headers, dialog titles.
- `text-2xl` (24px / line-height 32px): Dashboard KPI metric numbers.

### Spacing Grid
Based on an 8px grid (with 4px micro-offsets):
- `p-1` / `gap-1`: 4px
- `p-2` / `gap-2`: 8px
- `p-3` / `gap-3`: 12px
- `p-4` / `gap-4`: 16px
- `p-6` / `gap-6`: 24px
- `p-8` / `gap-8`: 32px

---

## 🛡️ 3. Card Elevation & Border Standards

- **Page Canvas**: `#F8FAFC` (`slate-50`)
- **Card Background**: `#FFFFFF` (`white`)
- **Card Border**: `1px solid #E2E8F0` (`slate-200`)
- **Card Radius**: `12px` (`rounded-xl` / `borderRadiusLG: 12`)
- **Card Shadow**: TailAdmin subtle elevation `shadow-xs` / `shadow-2xs`
- **Card Hover Effect**: Soft hover border transition to `border-slate-300` + `shadow-md`

---

## 📱 4. Mobile Responsiveness Standards (360px - 430px)

1. **Touch Targets**: All interactive elements (buttons, form inputs, select dropdowns, table action icons) must have a minimum height of `36px` to `44px`.
2. **Table Transformation**: On screens smaller than `768px`, dense data tables convert into structured card stacks rather than forcing wide horizontal scrolling.
3. **Ergonomic Bottom Navigation**: Mobile views feature a persistent, bottom navigation bar for high-frequency user actions (Home, My Claims, Submit Expense, Approvals, Profile).
