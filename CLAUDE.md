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

See the `here-maps-overlay` skill before mounting a HERE map or adding control overlays around one — it has the
z-index/isolation gotcha.

## Dialog design language

See the `dfrnt-dialog-design` skill before touching any dialog in
`dialogs/` — DialogShell/Header/Footer composition, styling precedence, icons, and testing gotchas all live there.
