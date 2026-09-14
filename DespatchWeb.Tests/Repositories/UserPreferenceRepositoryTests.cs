using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using JetBrains.Annotations;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for UserPreferenceRepository — the generic per-staff preference store whose
/// first tenant is the Auto-mate settings blob. Uses a SQLite in-memory DB.
/// </summary>
[TestSubject(typeof(UserPreferenceRepository))]
public class UserPreferenceRepositoryTests : IAsyncDisposable
{
    private const int StaffId = 123;
    private const int OtherStaffId = 456;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public UserPreferenceRepositoryTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetStaffId().Returns(StaffId);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private UserPreferenceRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock);

    [Fact]
    public async Task GetAsync_WhenNeverSaved_ReturnsNull()
    {
        // Null rather than an empty object: it is what tells the client to fall back
        // to the default instead of to "everything off".
        Assert.Null(await CreateRepository().GetAsync(PreferenceKeys.AutoMate));
    }

    [Fact]
    public async Task SaveAsync_ThenGetAsync_RoundTripsThePayload()
    {
        var repository = CreateRepository();

        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":true}""");

        Assert.Equal("""{"enabled":true}""", await repository.GetAsync(PreferenceKeys.AutoMate));
    }

    [Fact]
    public async Task SaveAsync_Twice_UpdatesInPlaceRatherThanAddingASecondRow()
    {
        var repository = CreateRepository();

        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":true}""");
        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":false}""");

        Assert.Equal("""{"enabled":false}""", await repository.GetAsync(PreferenceKeys.AutoMate));

        await using var context = await _contextFactoryMock.CreateDbContextAsync();
        Assert.Equal(1, await context.StaffPreferences.CountAsync(p => p.StaffId == StaffId));
    }

    [Fact]
    public async Task SaveAsync_StampsLastModifiedOnUpdate()
    {
        var repository = CreateRepository();
        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":true}""");

        await using (var first = await _contextFactoryMock.CreateDbContextAsync())
        {
            var row = await first.StaffPreferences.SingleAsync();
            Assert.Equal(row.CreatedUtc, row.LastModifiedUtc);
        }

        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":false}""");

        await using var context = await _contextFactoryMock.CreateDbContextAsync();
        var updated = await context.StaffPreferences.SingleAsync();
        Assert.True(updated.LastModifiedUtc >= updated.CreatedUtc);
    }

    [Fact]
    public async Task OneStaffMemberCannotSeeAnother()
    {
        var repository = CreateRepository();
        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":false}""");

        _tenantInfoServiceMock.GetStaffId().Returns(OtherStaffId);

        // The staff id is resolved per call, never cached, so the same repository
        // instance must not leak the first user's answer to the second.
        Assert.Null(await CreateRepository().GetAsync(PreferenceKeys.AutoMate));
    }

    [Fact]
    public async Task SaveAsync_ForOneStaffMemberLeavesAnothersRowAlone()
    {
        await CreateRepository().SaveAsync(PreferenceKeys.AutoMate, """{"enabled":false}""");

        _tenantInfoServiceMock.GetStaffId().Returns(OtherStaffId);
        await CreateRepository().SaveAsync(PreferenceKeys.AutoMate, """{"enabled":true}""");

        await using var context = await _contextFactoryMock.CreateDbContextAsync();
        Assert.Equal(2, await context.StaffPreferences.CountAsync());
        Assert.Equal(
            """{"enabled":false}""",
            await context.StaffPreferences
                .Where(p => p.StaffId == StaffId)
                .Select(p => p.PreferenceJson)
                .SingleAsync());
    }

    [Fact]
    public async Task DifferentKeysForTheSameStaffMemberAreSeparateRows()
    {
        var repository = CreateRepository();

        await repository.SaveAsync(PreferenceKeys.AutoMate, """{"enabled":true}""");
        await repository.SaveAsync("SomethingElse", """{"x":1}""");

        Assert.Equal("""{"enabled":true}""", await repository.GetAsync(PreferenceKeys.AutoMate));
        Assert.Equal("""{"x":1}""", await repository.GetAsync("SomethingElse"));
    }
}
