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

So: whenever you mount a HERE map, put `isolation: 'isolate'` on the element that directly wraps the map container. This traps HERE's internal z-index below the sibling overlays. Apply it **inline** — the `style` prop on a Mantine component, or `sx` on one of the map files still awaiting conversion — and never as a `.module.css` rule, so it stays unit-testable with `toHaveStyle({isolation: 'isolate'})`; CSS-module classes are mocked to `{}` in Jest.

Mantine overlays default to a *lower* z-index than MUI's (200–300 vs HERE's ~1001), so re-verify every map wrapper as it converts — and check that the island's stylesheet is actually loaded by its route or lazy-load service. An orphaned `.module.css` has already silently dropped this rule once.

**Reference implementations:** `dispatch-map/DispatchMap.tsx`, `here-map/HereMap.tsx`, `pages/courier-map/CourierMapPage.tsx`.

## Dialog design language

All React dialogs in `wwwroot/app/react/components/dialogs/` are **Mantine**. Compose them from the shared primitives in `dialogs/shared/mantine/` — `<DialogShell>` + `<DialogHeader>` + `<DialogFooter>` — which are the single source of truth for the DFRNT dialog language and are already WCAG-correct. Do not invent a new dialog style without asking.

**Reference implementations:**
- `wwwroot/app/react/components/dialogs/edit-date-time-dialog/EditDateTimeDialog.tsx` — the compact canonical shape (276 lines)
- `wwwroot/app/react/components/dialogs/accessorial-charges-dialog/AccessorialChargesDialog.tsx` — sections, a table, and the header `actions` slot

> **The MUI set in `dialogs/shared/` is legacy and shrinking.** A handful of dialogs still import it while they await conversion. Never point a new or converted dialog at it, and never add `sx` — see *Migrating a dialog off MUI* below.

**Shell**

```tsx
<DialogShell opened={opened} onClose={onClose} size={dialogSize.md} label="Edit charges">
    <DialogHeader icon={<Icon lucide={Receipt} />} title="…" subtitle="…" onClose={onClose} />
    {/* content */}
    <DialogFooter onCancel={onClose} onConfirm={save} submitting={saving} />
</DialogShell>
```

- `size` takes a **number**, not a breakpoint. Use `dialogSize.sm | md | lg` (560 / 760 / 1000) — a dialog converted from MUI's `maxWidth="md"` without one silently collapses to the 560 default.
- The shell is centered, `padding={0}` (header/content/footer own their padding), `radius="xl"` (the theme's 28px), and scrolls its content region via `dialogShellStyles`.
- The overlay is a **light, unblurred scrim on purpose** (`backgroundOpacity={0.25}`) — dialogs open over the dispatch job list and operators need to keep reading it. Pass `overlayProps` only where a heavy surround is the point (the POD photo viewer).
- `label` sets the accessible name on the `role="dialog"` node.

**Header — always `<DialogHeader>`**

`<DialogHeader icon title subtitle onClose variant actions closeDisabled />`. A solid brand/semantic fill with its own on-colour, no gradient and no divider — the colour change is the separator. Pass `variant="error"` for destructive dialogs, `"warning"` for cautionary; the fill carries the semantic colour and the shape is unchanged.

Only when a header genuinely needs bespoke content, build it from the helpers in `dialogs/shared/mantine/styles.ts`: `headerChromeStyle(variant)`, `headerChipProps(variant, size)`, `headerOnColor(variant)`, `headerOverlayColor(opacity, variant)`, `headerColors`, `headerSurfaceAccent`. Extra controls belong in the `actions` slot, styled with `headerOnColor`/`headerOverlayColor` so they read on the fill. Tune the bar height and chip size in `styles.ts`, never per dialog.

**Content**

- Content sits directly inside the shell. Background comes from `dialogContentBg`; each logical section is a `<Paper {...sectionPaperProps}>` with an optional `<Text {...sectionLabelProps}>` label above it.
- Sticky header/footer chrome inside a scrolling content region uses `dialogStickyChromeStyle('top' | 'bottom')`.
- Status/info messaging is Mantine `<Alert color=… icon=… title=…>`. Note it renders `role="alert"` (an assertive live region) — wrong for a persistent contextual banner, which wants `role="region"` and its own markup.
- Display pills are `<Badge variant="light">`; selectable ones are `<Chip>`. Use `variant="light"` rather than hand-mixing `alpha()` for fill/border/text.
- Selectable rows: `<Radio.Group>` / `<Checkbox.Group>` (one tab stop, arrow keys), or `Radio.Card` / `Checkbox.Card` when the whole card is the control. No custom border per row.
- Numbers use `<NumberInput>` (`decimalScale`, `min`/`max`, `clampBehavior`), with a currency marker in `leftSection` — never `prefix`. Currency *display* goes through `utils/currencyUtils.formatCurrency`, which is the tenant-aware path.
- Truncation is `<Text truncate>` / `lineClamp={n}`, not a three-property CSS incantation.

**Footer — `<DialogFooter>`**

`onCancel` / `onConfirm` / `confirmLabel` / `cancelLabel` / `confirmIcon` / `confirmColor` / `confirmDisabled` / `submitting` / `hideConfirm` / `hideCancel` / `secondaryAction`. `submitting` swaps the confirm icon for a loader and disables both buttons. Its keyline comes from `dialogFooterBorder`.

**Styling — native Mantine first**

There is no `sx` in this codebase. Reach for, in order, and only fall past a step when the one above genuinely cannot express the design:

1. **A native component** — `Divider` between rows, `CloseButton`, `CopyButton`, `ThemeIcon` for a tinted tile, `Alert`, `Avatar`, `NumberInput`, `Select` with grouped `data`.
2. **A native prop or style prop** — `tt`, `fw`, `fz`, `c`, `bg`, `maw`, `h`, `visibleFrom`/`hiddenFrom`, `Flex direction={{base, sm}}`, `Group grow`. These cover most of what `sx` did, responsive cases included.
3. **The component's own CSS variables** — `--ai-bg`/`--ai-hover` on `ActionIcon`, `--button-hover` on `Button`. A hover on a Mantine control is a variable, not a stylesheet. Do **not** use `styles={{root: {'&:hover': …}}}` — it lands as an inline style and the pseudo-selector is silently dropped.
4. **The Styles API** — `styles={{label: {whiteSpace: 'normal'}}}` for a property on an inner slot.
5. **A co-located `*.module.css`** — last resort, only for what CSS alone can do: `:hover`/`:focus-within` repainting a *descendant*, `::before`/`::after`, `@keyframes`, `[data-*]` state selectors.

**If a stylesheet contains no pseudo-class, pseudo-element, keyframe or descendant selector, it should not exist** — those rules belong on the component as props. When you do write one, keep the **resting** value in the stylesheet next to the pseudo-state rule: inline styles outrank class rules, so an inline resting colour makes its own hover rule unreachable.

**Units:** Mantine's numeric `gap`/`p`/`m` are **pixels**; MUI's were 8px units. A density spec carried over as `gap: 2` silently becomes 2px — re-express it explicitly.

**Prefer a `@mantine/hooks` hook over a hand-written effect:** `useDebouncedValue`/`useDebouncedCallback`, `useDisclosure` (for discrete open/close handlers — not for a controlled boolean-setter prop), `useLocalStorage` (pass `getInitialValueInEffect: false`, and explicit `serialize`/`deserialize` for any key already stored in a bare format), `useInterval`/`useTimeout`, `useHotkeys` (binds to `document`; use `useWindowEvent` for events dispatched on `window`), `useListState`, `useClipboard`.

**Migrating a dialog off MUI**

- Swap `dialogs/shared` → `dialogs/shared/mantine`, delete every `sx`, and drop the `MuiThemeIsland` wrapper from the island entry **only** once the subtree is provably MUI-free — then re-run `theme/islandProviders.spec.ts`.
- Islands mount through `islandTree()` / `mountReactIsland()` in `theme/DfrntMantineProvider.tsx`. **Mantine must be outermost, MUI nested inside:** Mantine's `useStyles` throws without a provider, MUI silently falls back. A still-MUI host whose leaf has converted needs `renderWithMantineOverMui` in its tests.
- When you add a `.module.css`, confirm its loader — a `routes.ts` entry *or* a lazy-load service — pairs script and stylesheet, and pin it with a test. Three islands have shipped a stylesheet nothing loaded, one of which silently dropped a map's `isolation: isolate`.

**Icons**

One wrapper, one stroke: `<Icon lucide={Search}/>` for generic UI chrome,
`<Icon tabler={IconTruck}/>` for transport/logistics. Import the Lucide/Tabler
component **directly** at the call site.

`components/common/icon/iconMap.ts` maps every `@mui/icons-material` name the app
used to its replacement — use it as a **lookup table while converting**, never as
a runtime import. It is one object literal over ~209 components indexed
dynamically, so esbuild cannot tree-shake it and a single runtime importer bundles
every glyph (+178 KB, measured). `iconMap.spec.tsx` fails the build's test run if
any non-test file imports it without `import type`.

A registry that must resolve a **data-supplied string** to a component keeps its
own local table of direct imports — see `symbol-icon/SymbolIcon.tsx` and
`task-history/eventIcons.tsx`. Both stamp the name they resolved
(`data-symbol-icon` / `data-event-icon`) because Lucide and Tabler emit no test
hook of their own, where MUI auto-generated `data-testid="FooIcon"`. Assert on
that stamp — it proves the data reached the DOM — and put glyph-identity
assertions in the resolver's unit test.

**Testing dialogs**

Query by visible text, `getByLabelText` or `getByRole` — never class names. Use `renderWithMantine` / `renderWithMantineProviders` / `renderWithMantineOverMui` from `react/__testUtils__`. Mantine specifics that bite:

- `required` appends an asterisk to a label — `getByLabelText('X')` breaks; match `/X/`.
- `Select`'s input is `role="combobox"` and pairs with a hidden input, so a label matches two elements.
- `DateTimePicker`/`DatePickerInput` render a `<button>`, not an input. An inline calendar is a `<table>` of day `<button>`s labelled `"20 January 2025"` — no `grid`/`gridcell` roles.
- **Pass `defaultDate` on every inline calendar.** A Mantine calendar opens on the *current* month, not on its `value`.
- `SegmentedControl` renders radios, not buttons. A disabled `Menu.Item` gets `data-disabled`, not `aria-disabled`.
- `Loader` has no implicit role — give it an `aria-label`. `Tooltip` adds no `title` attribute.
- `MantineProvider` injects a `<style>` element, so `container.firstChild` is never `null` — assert absence of `role="dialog"` instead.
- Animations are zeroed globally in `wwwroot/app/tests/setup.ts`; don't use `waitForElementToBeRemoved` for a closing dialog.
