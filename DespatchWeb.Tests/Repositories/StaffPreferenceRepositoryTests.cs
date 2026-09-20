using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for StaffPreferenceRepository — the generic per-staff key/value
/// preference store backing the Settings page. Uses a SQLite in-memory DB.
/// </summary>
public class StaffPreferenceRepositoryTests : IAsyncDisposable
{
    private const int StaffId = 123;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public StaffPreferenceRepositoryTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetStaffId().Returns(StaffId);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private StaffPreferenceRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        new FakeTenantClock(TestDates.Now));

    [Fact]
    public async Task GetPreferenceAsync_WhenNoneSaved_ReturnsNull()
    {
        var repository = CreateRepository();

        var result = await repository.GetPreferenceAsync("AutoMate");

        Assert.Null(result);
    }

    [Fact]
    public async Task SetPreferenceAsync_ThenGet_RoundTripsTheJson()
    {
        var repository = CreateRepository();

        await repository.SetPreferenceAsync("AutoMate", "{\"aiEnabled\":true}");

        Assert.Equal("{\"aiEnabled\":true}", await repository.GetPreferenceAsync("AutoMate"));
    }

    [Fact]
    public async Task SetPreferenceAsync_CalledAgain_UpdatesInPlaceRatherThanDuplicating()
    {
        var repository = CreateRepository();
        await repository.SetPreferenceAsync("AutoMate", "{\"aiEnabled\":false}");

        await repository.SetPreferenceAsync("AutoMate", "{\"aiEnabled\":true}");

        Assert.Equal("{\"aiEnabled\":true}", await repository.GetPreferenceAsync("AutoMate"));
        await using var context = _db.CreateContext();
        Assert.Equal(1, await context.StaffPreferences.CountAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task SetPreferenceAsync_PreservesCreatedUtcOnUpdate()
    {
        var repository = CreateRepository();
        await repository.SetPreferenceAsync("AutoMate", "{\"v\":1}");

        Guid id;
        DateTime created;
        await using (var context = _db.CreateContext())
        {
            var row = await context.StaffPreferences.SingleAsync(TestContext.Current.CancellationToken);
            id = row.Id;
            created = row.CreatedUtc;
        }

        await repository.SetPreferenceAsync("AutoMate", "{\"v\":2}");

        await using (var context = _db.CreateContext())
        {
            var row = await context.StaffPreferences.SingleAsync(TestContext.Current.CancellationToken);
            Assert.Equal(id, row.Id); // same row, not recreated
            Assert.Equal(created, row.CreatedUtc); // CreatedUtc untouched
        }
    }

    [Fact]
    public async Task DifferentKeys_ForTheSameStaffMember_AreStoredIndependently()
    {
        var repository = CreateRepository();

        await repository.SetPreferenceAsync("AutoMate", "{\"a\":1}");
        await repository.SetPreferenceAsync("Nationwide", "{\"b\":2}");

        Assert.Equal("{\"a\":1}", await repository.GetPreferenceAsync("AutoMate"));
        Assert.Equal("{\"b\":2}", await repository.GetPreferenceAsync("Nationwide"));
    }

    [Fact]
    public async Task GetPreferenceAsync_DoesNotLeakAnotherStaffMembersValue()
    {
        var repository = CreateRepository();
        await using (var context = _db.CreateContext())
        {
            context.StaffPreferences.Add(new StaffPreference
            {
                Id = Guid.NewGuid(),
                StaffId = 999,
                PreferenceKey = "AutoMate",
                PreferenceJson = "{\"theirs\":true}",
                CreatedUtc = DateTime.UtcNow,
                LastModifiedUtc = DateTime.UtcNow,
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        Assert.Null(await repository.GetPreferenceAsync("AutoMate"));
    }
}
