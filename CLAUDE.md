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

### Frontend (Vite + Jest)

```bash
# Run specific test files matching a pattern
cd DespatchWeb.Client && npx jest --testPathPatterns="<pattern>" --no-coverage

# Run all frontend tests
cd DespatchWeb.Client && npx jest --no-coverage
```

The SPA is `DespatchWeb.Client/` (Vite 8, `src/`, `index.html`). `npm run build` (`tsc -b && vite build`) writes `wwwroot/dist`; `npm run dev` runs the dev server, proxying `/api` and the MVC routes to the .NET host.

## Test mocking — NSubstitute, not Moq

New C# tests use NSubstitute. Some legacy tests use Moq; migrate them when you
touch them, never add new Moq usage. `await` received-checks on async methods.
For SQLite-backed repository tests use `SqliteTestDatabase.CreateFactoryMock(context)`,
not `CreateMoqFactoryMock`.

## Code comments

Only write comments when they are necessary and useful. Prefer self-explanatory code and avoid comments that restate what the code already says. When a comment is warranted (e.g. non-obvious "why" rationale), keep it to a concise summary rather than a step-by-step narration.

## Database migrations

Schema changes go in `dbmigrationsv2\DatabaseScripts\Migrations\`
(`YYYYMMDDHHMMSS_Description.sql`), never in this repo. Load the
`legacy-db-policy` skill before writing any migration or index.

## HERE Maps overlay controls

See the `here-maps-overlay` skill before mounting a HERE map or adding control overlays around one — it has the
z-index/isolation gotcha.

## Dialog design language

See the `dfrnt-dialog-design` skill before touching any dialog in
`dialogs/` — DialogShell/Header/Footer composition, styling precedence, icons, and testing gotchas all live there.

## Frontend layout (`DespatchWeb.Client/src`)

Mirrors IntegrationManager's AdminPortal: `main.tsx` / `App.tsx` (root + `mountSpa`), `api/` (HTTP wrappers, `client.ts`, `session.ts`, query client), `components/` (shared UI, `dialogs/` + dialog registry, `layout/PageFrame`), `pages/` (one folder per page, with its `*Screen` wrapper beside it), `routes/` (route table, navigation context, guards, app loader), `hooks/`, `services/` (non-HTTP flows, toasts), `theme/`, `constants/`, `types/` (interfaces, `enums/`), `utils/`, `test/` (setup, mocks, `utils/` test helpers). Imports are relative; tests sit beside the code.
