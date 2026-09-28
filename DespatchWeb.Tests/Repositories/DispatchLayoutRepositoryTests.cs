using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for DispatchLayoutRepository — the row-per-layout persistence used to
/// sync dashboard layouts across browser sessions. Uses a SQLite in-memory DB.
/// </summary>
public class DispatchLayoutRepositoryTests : IAsyncDisposable
{
    private const int StaffId = 123;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public DispatchLayoutRepositoryTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetStaffId().Returns(StaffId);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DispatchLayoutRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        new FakeTenantClock(TestDates.Now));

    private static DispatchLayoutDto Layout(string name, string json = "{}", bool isActive = false) =>
        new() { Name = name, LayoutJson = json, IsActive = isActive };

    [Fact]
    public async Task GetLayoutsAsync_WhenNoneSaved_ReturnsEmpty()
    {
        var repository = CreateRepository();

        var result = await repository.GetLayoutsAsync("JobSearch");

        Assert.Empty(result);
    }

    [Fact]
    public async Task ReplaceLayoutsAsync_InsertsNewLayouts()
    {
        var repository = CreateRepository();

        await repository.ReplaceLayoutsAsync("JobSearch",
        [
            Layout("Wide", "{\"a\":1}", isActive: true),
            Layout("Narrow", "{\"b\":2}")
        ]);

        var result = await repository.GetLayoutsAsync("JobSearch");
        Assert.Equal(2, result.Count);
        var wide = Assert.Single(result, l => l.Name == "Wide");
        Assert.Equal("{\"a\":1}", wide.LayoutJson);
        Assert.True(wide.IsActive);
        Assert.False(Assert.Single(result, l => l.Name == "Narrow").IsActive);
    }

    [Fact]
    public async Task ReplaceLayoutsAsync_UpdatesExistingAndDeletesMissing()
    {
        var repository = CreateRepository();

        await repository.ReplaceLayoutsAsync("JobSearch",
        [
            Layout("Wide", "{\"v\":1}", isActive: true),
            Layout("Narrow", "{\"v\":1}")
        ]);

        // Re-save: update Wide, drop Narrow, add Tall.
        await repository.ReplaceLayoutsAsync("JobSearch",
        [
            Layout("Wide", "{\"v\":2}"),
            Layout("Tall", "{\"v\":1}", isActive: true)
        ]);

        var result = await repository.GetLayoutsAsync("JobSearch");
        Assert.Equal(2, result.Count);
        Assert.DoesNotContain(result, l => l.Name == "Narrow");

        var wide = Assert.Single(result, l => l.Name == "Wide");
        Assert.Equal("{\"v\":2}", wide.LayoutJson);
        Assert.False(wide.IsActive);
        Assert.True(Assert.Single(result, l => l.Name == "Tall").IsActive);
    }

    [Fact]
    public async Task ReplaceLayoutsAsync_PreservesCreatedUtcOnUpdate()
    {
        var repository = CreateRepository();
        await repository.ReplaceLayoutsAsync("JobSearch", [Layout("Wide")]);

        Guid id;
        DateTime created;
        await using (var context = _db.CreateContext())
        {
            var row = await context.StaffDispatchLayouts.SingleAsync(TestContext.Current.CancellationToken);
            id = row.Id;
            created = row.CreatedUtc;
        }

        await repository.ReplaceLayoutsAsync("JobSearch", [Layout("Wide", "{\"changed\":true}")]);

        await using (var context = _db.CreateContext())
        {
            var row = await context.StaffDispatchLayouts.SingleAsync(TestContext.Current.CancellationToken);
            Assert.Equal(id, row.Id); // same row, not recreated
            Assert.Equal(created, row.CreatedUtc); // CreatedUtc untouched
        }
    }

    [Fact]
    public async Task GetLayoutsAsync_IsScopedToStaffAndPage()
    {
        var repository = CreateRepository();
        await repository.ReplaceLayoutsAsync("JobSearch", [Layout("Mine")]);
        await repository.ReplaceLayoutsAsync("Dispatch", [Layout("MyDispatch")]);

        // A layout belonging to a different staff member must not leak through.
        await using (var context = _db.CreateContext())
        {
            context.StaffDispatchLayouts.Add(new StaffDispatchLayout
            {
                Id = Guid.NewGuid(),
                StaffId = 999,
                Page = "JobSearch",
                Name = "Theirs",
                LayoutJson = "{}",
                IsActive = false,
                CreatedUtc = DateTime.UtcNow,
                LastModifiedUtc = DateTime.UtcNow
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var jobSearch = await repository.GetLayoutsAsync("JobSearch");
        Assert.Equal("Mine", Assert.Single(jobSearch).Name);
    }

    [Fact]
    public async Task ReplaceLayoutsAsync_WithEmptyList_ClearsAllForPage()
    {
        var repository = CreateRepository();
        await repository.ReplaceLayoutsAsync("JobSearch", [Layout("Wide"), Layout("Narrow")]);

        await repository.ReplaceLayoutsAsync("JobSearch", []);

        Assert.Empty(await repository.GetLayoutsAsync("JobSearch"));
    }
}
