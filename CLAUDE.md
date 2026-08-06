# DespatchWeb - Claude Code Instructions

## Running Tests

The test project uses **xUnit v3** which produces a self-contained executable. Do NOT use `dotnet test` — it fails with test discovery issues on this project.

### Backend (C# / xUnit)

```bash
# Build first
dotnet build

# Run all tests
C:/Users/jacobt/RiderProjects/despatchweb/DespatchWeb.Tests/bin/Debug/net10.0/DespatchWeb.Tests.exe

# Check for failures
C:/Users/jacobt/RiderProjects/despatchweb/DespatchWeb.Tests/bin/Debug/net10.0/DespatchWeb.Tests.exe 2>&1 | grep -E "FAIL|SUMMARY|Total:"
```

### Frontend (Jest)

```bash
# Run specific test files matching a pattern
cd wwwroot && npx jest --testPathPatterns="<pattern>" --no-coverage

# Run all frontend tests
cd wwwroot && npx jest --no-coverage
```

## Workflow

Work test-first: write the failing test before the implementation (see the `tdd-workflow` skill), then make it pass with the test commands in *Running Tests* above. Every behavioural change lands with a test that would fail without it.

Bug reports go through the `fix-bug` skill (it is test-first, so it replaces `tdd-workflow` for that change). Its generic fallbacks do **not** apply here: use the commands in *Running Tests* above — the xUnit v3 executable, never `dotnet test` — and NSubstitute, never Moq.

## Test mocking — use NSubstitute, not Moq

New C# tests must use **NSubstitute** for test doubles, not Moq. Some legacy tests still use Moq; migrate them to NSubstitute opportunistically when you touch them, but never add new Moq usage.

- Create substitutes with `Substitute.For<IService>()` (a plain field, no `.Object` indirection).
- Stub with `sub.Method(args).Returns(value)`; `Task`/`Task<T>` methods auto-return completed tasks, so only stub when the value matters.
- Verify with `await sub.Received(1).MethodAsync(...)` / `sub.DidNotReceive()` / `sub.DidNotReceiveWithAnyArgs()` — `await` the received-check on async methods. Match arguments with `Arg.Any<T>()` / `Arg.Is<T>(...)`.
- For the SQLite-backed repository tests, get the context factory from `SqliteTestDatabase.CreateFactoryMock(context)` (the NSubstitute helper) rather than the `CreateMoqFactoryMock` variant.

## Code comments

Only write comments when they are necessary and useful. Prefer self-explanatory code and avoid comments that restate what the code already says. When a comment is warranted (e.g. non-obvious "why" rationale), keep it to a concise summary rather than a step-by-step narration.

## Database migrations

DB schema changes go in the migrations project at `C:\Users\jacobt\RiderProjects\dbmigrationsv2\DatabaseScripts\Migrations\` using the existing `YYYYMMDDHHMMSS_Description.sql` convention. Do not put SQL inside the despatchweb repo.

When adding indexes in a migration, only use **plain (non-unique, non-filtered) B-tree indexes**. Specifically:

- No `CREATE UNIQUE INDEX` — uniqueness lives on the column definition or via a constraint, not the index itself.
- No filtered indexes (`WHERE …` clause). If a query benefits from filtering, put the filter columns in the index key instead (e.g. composite `(Status, CreatedAt)` rather than `WHERE Status = 'X'` filtered on `(CreatedAt)`).
- No included columns (`INCLUDE (…)`). Add them to the key if they're needed.

If a use case genuinely needs a unique or filtered index, stop and ask first.

## HERE Maps overlay controls

HERE Maps renders its own info bubbles and marker tooltips **inside the map container DOM at a high z-index (~1001)**. Any React control overlay rendered as a **sibling** of the map container (the zoom/layer rails, fit-all/refresh buttons, drivers panel, etc. — typically `zIndex: 10`–`50`) will be painted over and become unclickable unless the **map container establishes its own stacking context**.

So: whenever you mount a HERE map, put `isolation: 'isolate'` (via `sx`) on the element that directly wraps the map container. This traps HERE's internal z-index below the sibling overlays. Apply it via `sx` (not a `.module.css` rule) so it is unit-testable with `toHaveStyle({isolation: 'isolate'})` — CSS-module classes are mocked to `{}` in Jest.

**Reference implementations:** `dispatch-map/DispatchMap.tsx`, `here-map/HereMap.tsx`, `pages/courier-map/CourierMapPage.tsx`.

## Dialog design language

All React dialogs in `wwwroot/app/react/components/dialogs/` should follow the visual language established by the job-detail edit dialogs — `EditDateTimeDialog.tsx` and `EditParcelDimensionsDialog.tsx` are the canonical references. New dialogs default to this style; existing dialogs are migrated opportunistically. Do not invent a new dialog style without asking.

**Reference implementations:**
- `wwwroot/app/react/components/dialogs/edit-date-time-dialog/EditDateTimeDialog.tsx`
- `wwwroot/app/react/components/dialogs/edit-parcel-dimensions-dialog/EditParcelDimensionsDialog.tsx`

The previously-flagged legacy holdouts (`SendPodDialog`, `SimplePriceEditDialog`) have since been migrated to this pattern, so there are no remaining "do not copy" dialogs.

**Dialog wrapper**

- `maxWidth="sm"`, `fullWidth`.
- `slotProps.paper`: `elevation: 24` and `sx: { overflow: 'hidden', minWidth: 480, maxWidth: 600 }`. The corner radius is the theme's MD3 extra-large (28px) `MuiDialog` default — don't re-set it per dialog (`<DialogShell>` already omits it).

**Header — prefer the shared `<DialogHeader>` primitive**

New dialogs should render `<DialogHeader icon={…} title={…} subtitle={…} onClose={…} variant="primary|error" />` rather than hand-rolling the header — it is the single source of truth and is already WCAG-correct. When a header genuinely needs bespoke content (extra actions, tabs), build it from the shared helpers in `dialogs/shared/styles.ts`: `headerChromeSx` (container), `headerChipSx` (icon chip), plus `headerAccentColor` / `headerOnColor` / `headerOverlayColor`.

The header is a **solid brand/semantic fill** (the variant's `main`) with its own on-colour (`contrastText`) for text and icons — white-on-blue for the US tenant, dark-on-gold for the amber tenant, white-on-red for error, etc. A bold, flat bar with **no gradient** (the master look, minus the gradient) and no divider — the colour change is the separator. The fill + on-colour and the bar height/chip size are **centralized** in `headerSurfaceSx`/`headerChromeSx`/`headerChipSx` — tune them there, not per-dialog.

- Container: spread `headerChromeSx(theme, variant)` — the solid fill + `contrastText` text plus the standard `px`, `py`, flex layout and `gap`. Append per-header extras (`flexShrink: 0`) or override `px`/`py` only for a bespoke compact header (e.g. the panel bar, the messaging header).
- Icon badge: spread `headerChipSx(theme, variant)` on a `<Box>` (default 40×40, a translucent `contrastText` scrim + `contrastText` glyph, glyph auto-sized) and drop a bare `{icon}` inside — no per-icon `fontSize`. Pass a third `size` arg for a compact chip (e.g. `headerChipSx(theme, 'primary', 32)`). A **bare** header icon (no badge) instead takes `color: headerAccentColor(theme, variant)` (= the on-colour).
- Title block uses `sx={{flex: 1}}` so the close button anchors to the right.
- Title: `<Typography variant="h6" fontWeight={600}>` (inherits the header's `contrastText`).
- Optional subtitle: `<Typography variant="body2" sx={{opacity: 0.85, mt: 0.25}}>` — inherits the header colour at reduced opacity. Use `&middot;` (`·`) as the separator between identifiers.
- Close button: plain `<IconButton>` with `sx={(t) => ({color: headerOnColor(t), '&:hover': {bgcolor: headerOverlayColor(t, 0.1)}})}` and `aria-label="Close dialog"`. No fixed size — the theme gives icon buttons a 44px hit target.
- Error/destructive dialogs pass `variant="error"`, caution dialogs `variant="warning"` — the solid fill carries the semantic colour. Same shape either way.

**Content**

- `<DialogContent sx={{p: 0, bgcolor: 'background.default'}}>` with an inner `<Box sx={{p: 3, display: 'flex', flexDirection: 'column', gap: 3}}>` that holds the actual content. The content area's `background.default` separates it visually from the white `<Paper>` sections inside.
- Each logical section is a `<Paper elevation={0} sx={{bgcolor: 'background.paper', borderRadius: 1.5, p: 2.5, border: '1px solid', borderColor: 'divider'}}>` — prefer spreading the shared `sectionPaperSx` constant rather than re-typing it. `borderRadius: 1.5` is the MD3 medium (12px) card corner; use theme tokens (`background.paper`, `divider`), not literal `'white'`/`'grey.200'`. Optional field label above the paper: `<Typography variant="body2" sx={{color: 'text.secondary', fontWeight: 500, mb: 1}}>` (the `sectionLabelSx` constant).
- Status/info/error messaging uses MUI's `<Alert severity="info|success|warning|error">` directly — do not roll a custom callout `<Box>`.
- Status chips: stock MUI `<Chip size="small" color="primary" variant="outlined">`.
- Selectable rows (radio/checkbox lists): use MUI defaults inside a `<Paper>` — the radio/checkbox already signals selection; no custom border on each row.
- TextField: `size="small"`, `fullWidth`, and `sx={{ '& .MuiOutlinedInput-root': { bgcolor: 'background.paper' } }}` (the `dialogFieldSx` constant) so it stands out against the `background.default` content area.

**Footer — `<DialogActions>`**

- `sx={(theme) => ({px: 3, py: 2, bgcolor: 'background.paper', borderTop: `1px solid ${theme.palette.divider}`, gap: 1})}`.
- Cancel button (left): `variant="outlined"`, `sx={{minWidth: 100}}`.
- Primary action (right): `variant="contained" color="primary"`, `sx={{minWidth: 100}}`. Use `startIcon` for the action glyph, swap for `<CircularProgress size={16} color="inherit" />` while submitting.

**General**

- Style with the MUI `sx` prop using theme palette + `alpha()` where needed — do not introduce CSS Modules or stylesheets for new dialogs.
- Animations: rely on MUI defaults; don't add bespoke transitions unless the design genuinely needs them.
- Tests should query by visible text, `getByLabelText`, or `getByRole` — not by class names — so styling refactors don't break them.

**Spacing — use the spacing scale**

Dialog chrome uses the regular spacing scale (`px: 3, py: 2, gap: 2`, `gap: 1.5`, `mt: 0.25` etc.), matching the rest of the codebase. Avoid pixel string literals like `p: '20px'` or `gap: '14px'` — a previous-generation convention that has since been removed from the dialogs.

**Style constant typing**

When extracting an `sx` object into a named constant, validate it against MUI's types with `satisfies SxProps<Theme>`:

```ts
import type {SxProps, Theme} from '@mui/material';

const sectionPaperSx = {
    bgcolor: 'background.paper',
    borderRadius: 1.5,
    p: 2.5,
    border: '1px solid',
    borderColor: 'divider',
} satisfies SxProps<Theme>;
```

`satisfies` catches typos in theme paths (`'grey.250'`, `'primary.medium'`) while preserving the inferred literal shape, so the constant remains spread-friendly: `<Paper sx={{...sectionPaperSx, p: 2}}>` still type-checks. Prefer this over a bare `SxProps<Theme>` annotation (which widens the type and breaks spreading) and over `as const` alone (which gives no validation against MUI's schema).
