# LocDoc OMS3 — Design & Theme Guide

> Reference for building new UI consistent with the existing OMS3 client. This is a
> **read-only summary** of the design system as implemented today. Source of truth:
> [client/src/settings/theme.ts](../client/src/settings/theme.ts).

---

## 1. Tech Stack

- **Framework:** React + TypeScript (Vite), PWA.
- **UI library:** Material UI (MUI) v7 — `@mui/material`, `@mui/icons-material`, `@mui/lab`.
  - Data grids: `@mui/x-data-grid-premium` (v6).
  - Date pickers: `@mui/x-date-pickers(-pro)` (v6).
  - Charts: `@mui/x-charts` (v6).
  - Rich text: `mui-tiptap`.
- **Styling engine:** Emotion (`@emotion/react`, `@emotion/styled`); `styled-components` is present but rarely used.
- **Primary styling approach:** the MUI `sx` prop (~160 component files) reading from a custom theme via `ThemeContext`. `styled()` is used in only ~2 places — prefer `sx`.

---

## 2. Theme Architecture

The theme is **not** a stock MUI theme. It is a plain config object (`Theme`) in
[client/src/settings/theme.ts](../client/src/settings/theme.ts) with three palettes:

| Palette | Key | When used |
|---------|-----|-----------|
| Light (default) | `Theme.theme` | Default; `isLightTheme === true` |
| Dark | `Theme.themeDark` | `localStorage.ThemePreference === "Dark"` |
| Alt (gold/midnight) | `Theme.themeAlt` | Alternate brand option (not wired to a toggle by default) |

### How it's wired (App.tsx)
- State `appThemeConfig` holds the active palette config; `isLightTheme` toggles light/dark.
- `createAppTheme(appThemeConfig)` wraps the config in MUI's `createTheme()` and is memoized.
- Provided two ways:
  - `<ThemeProvider theme={Theme}>` — standard MUI theme (drives MUI internals).
  - `<ThemeContext.Provider value={appThemeConfig}>` — the **raw palette config** that components read directly.

### How components consume it
The dominant idiom — read the raw config from context, then reference palette keys:

```tsx
const theme = React.useContext(ThemeContext);
// ...
<Box sx={{ backgroundColor: theme?.palette?.repeater?.main,
           color: theme?.palette?.repeater?.text }} />
```

Always use **optional chaining** (`theme?.palette?.X?.Y`) — palette keys differ between
light/dark/alt and some are missing in certain palettes.

---

## 3. Color Palette

### Custom (non-standard MUI) palette keys
OMS3 extends the standard MUI palette with several custom slots. These are the ones to know:

| Key | Purpose | Sub-keys |
|-----|---------|----------|
| `repeater` | **Most-used** (~1900 refs). Card/list-row surfaces and repeated content blocks. | `main`, `text`, `contrastText`, `headerBar` |
| `TopBar` | Nav bar & login screen | `main`, `contrastText`, `buttonColor` |
| `Icons` | Default icon tint | `main` |
| `TextField` | Input field background/contrast | `backgroundColor`, `color`, `contrastText`, `disabled` |
| `Chip` | Chip fill/text defaults | `color`, `backgroundColor` |
| `dialog` | Dialog backdrop/surface | `backgroundColor` |
| `tertiary` / `quaternary` / `quinary` | Extra accent colors | `main`, `text`, `contrastText` |
| `primary` / `secondary` | Brand colors (extended) | `main`, `text`, `contrastText`, `backgroundColor`, `backgroundGradient1`, `backgroundGradient2` |

### Light theme reference values
| Role | Value |
|------|-------|
| primary.main | `#4f6498` (slate blue) |
| secondary.main | `#64984f` (green) |
| tertiary.main | `#5F4F98` (violet) |
| quaternary.main | `#4F8898` (teal) |
| quinary.main | `#985F4F` (rust) |
| error.main | `#A81C07` |
| success.main | `#2e7d32` |
| warning.main | `#ed6c02` |
| info.main | `#0288d1` |
| background.paper | `rgba(244,244,248,1)` (`#F4F4F8`) |
| background.default | `rgba(254,254,254,1)` (`#fefefe`) |
| repeater.main | `#F4F4F8` |
| repeater.headerBar | `#4f6498` |
| TopBar.main | `#fefefe` |
| common.white | `#fefefe` (note: not pure white) |

### Dark theme deltas
- `primary.main` → `#687eb1`, text → `#E6E6EA`.
- `repeater.main` → `#353635`, `repeater.text` → `#d5d5dc`, `repeater.headerBar` → `#64984f` (green).
- `TopBar.main` → `#353635`.
- `Icons.main` → `#64984f` (green, vs blue in light).
- TextField gets `color`, `contrastText`, and a `disabled: #888888`.

### Alt theme
Gold (`#FFD700`) + midnight-blue (`#2E3B4E`) brand. Available as a config but not bound to a UI toggle.

### Color usage guidance
- **Surfaces / cards / list rows:** use `palette.repeater.*` — this is the project's card convention.
- **Header bars within cards:** `palette.repeater.headerBar`.
- **Icons:** `palette.Icons.main` (or component-specific intent color).
- **Status:** `error` / `success` / `warning` / `info` for semantic states.
- Don't hardcode hex in new components — reference palette keys so dark mode keeps working.

---

## 4. Typography

- **Font family:** `"Open Sans", "Helvetica", "Arial", sans-serif` (set in theme typography).
- **Material Icons** loaded via Google Fonts stylesheet in `index.html`.
- Body fallback stack in [index.css](../client/src/index.css) uses the system font stack
  (`-apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", ...`) plus font smoothing.
- Use MUI `<Typography>` variants for text rather than raw tags.

---

## 5. Spacing, Shape & Layout Conventions

- **borderRadius:** overwhelmingly `borderRadius: 1` or `borderRadius: 2` (MUI spacing units, = 4px/8px). `3` and `"16px"` appear for larger cards; `"50%"` for circular. **Default to `1` or `2`.**
- **Spacing/gap:** prefer MUI numeric spacing (`gap: 1`, `gap: 0.5`). Pixel padding strings (`"10px"`, `"15px"`, `"0px 10px"`) are common in older components but theme-unit spacing is preferred for new work.
- **Layout primitives:** `Box`, `Stack`, `Grid` with `sx`.

---

## 6. Print Styles

[index.css](../client/src/index.css) defines print conventions (`@media print`). Honor these utility classes when building printable views (tickets, checks, receipts):

| Class | Effect |
|-------|--------|
| `.Print-Hide` | Hidden when printing |
| `.Print-Show` | Shown (flex) only when printing |
| `.Print-Check` | Full-page white check layout |
| `.Print-Padding` | 25px padding in print |
| `.Print-Change` | Removes box-shadow in print |
| `.Print-Font-Change` | Bold (700) in print |

In print, all text is forced to `#222` and backgrounds/images stripped, and MUI tooltips are hidden.

---

## 7. Component Patterns

- **Cards:** the `*Card.tsx` components (e.g. `ContactCard`, `FacilityCard`, `DocumentCard`,
  `KeySetCards`) are the canonical pattern for entity display — they use `palette.repeater.*`
  for surface + `headerBar` for the title strip. Match this for any new entity card.
- **Dialogs:** use `palette.dialog.backgroundColor`; many custom dialogs exist
  (`CheckDialog`, `NumericKeypadDialog`, `CreateRestockDialog`).
- **Chips:** `createAppTheme()` injects `MuiChip` style overrides so default (non-colored)
  chips automatically pick up `repeater.contrastText` / `Chip` colors and adapt to outlined
  vs filled. Don't manually re-style default chips — let the theme handle it.

---

## 8. Rules for New Designs (Checklist)

1. **Read the theme via `ThemeContext`** with optional chaining; never hardcode colors.
2. **Use `sx`**, not `styled()` or inline CSS.
3. **Surfaces use `repeater.*`**; semantic states use `error/success/warning/info`.
4. **Keep `borderRadius` at 1–2**; use numeric theme spacing for gaps/padding.
5. **Verify light AND dark** — some palette keys (e.g. `background.paperDark`, TextField
   `disabled`) only exist in some palettes; guard with `?.`.
6. **Reuse `*Card.tsx` patterns** for entity displays and dialog conventions for modals.
7. **Add print classes** (`Print-Hide` / `Print-Show` etc.) for any view that may be printed.
8. **Font is Open Sans** + Material Icons — don't introduce new font families.

---

*Generated from a read-only review of the OMS3 client. No OMS3 source was modified.*
