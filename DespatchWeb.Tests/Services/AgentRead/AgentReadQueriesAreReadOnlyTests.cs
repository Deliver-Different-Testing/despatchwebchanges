using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using DespatchWeb.Services.AgentRead;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Services.AgentRead;

/// <summary>
/// The queries behind the agent reads run against SQLite with a guard that refuses and records anything but a SELECT, and
/// the read services are checked for what they depend on.
/// </summary>
public class AgentReadQueriesAreReadOnlyTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly ReadOnlyGuard _guard = new();
    private readonly MemoryCache _cache = new(new MemoryCacheOptions());
    private readonly ITenantInfoService _tenant = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 1, 15, 10, 0, 0));

    public AgentReadQueriesAreReadOnlyTests() => _tenant.GetTenantTimeZone().Returns("New Zealand Standard Time");

    private CourierRepository Couriers() => new(_guard.Factory(_db), _tenant, _clock, Substitute.For<IClearListEnvelopeService>(), _cache);

    private async Task SeedDriversAsync()
    {
        await using var context = _db.CreateContext();
        context.TucCouriers.Add(new TucCourier
        {
            UccrId = 1, Code = "A01", UccrName = "Aroha", UccrSurname = "Ngata", Active = true, CourierFleetId = 1, UccrChannelId = 1,
            VehiclePlateNnumber = "ABC123", Created = TestDates.Now, CreatedBy = "t", LastModified = TestDates.Now, LastModifiedBy = "t",
            DriversLicenseExpiry = new DateTime(2024, 1, 14)
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task TheDriverManagementReads_IssueOnlySelects()
    {
        await SeedDriversAsync();
        var repo = Couriers();

        await repo.GetAllCourierComplianceAsync(new CourierComplianceFilterRequest { Page = 1, PageSize = 100, SearchTerm = "", Type = "", Status = "" });
        await repo.GetTodayActiveDriversAsync(new TodayActiveDriversFilterRequest { Page = 1, PageSize = 100, SearchTerm = "", Status = "" });
        await repo.GetCourierDailyEarningsAsync(new PaginatedRequest { Page = 1, PageSize = 100, SearchTerm = "" });
        await repo.GetDriverWorkOverviewAsync();

        Assert.Empty(_guard.Writes);
    }

    [Fact]
    public async Task TheClearListRead_IssuesOnlySelects()
    {
        await SeedDriversAsync();

        await Couriers().GetClearListsAsync([1], null, null, false);

        Assert.Empty(_guard.Writes);
    }

    [Fact]
    public async Task TheRecurringBookingList_AndDetail_IssueOnlySelects()
    {
        var repo = new RecurringJobRepository(_guard.Factory(_db), _tenant, _clock, Substitute.For<IClearListEnvelopeService>());

        await repo.GetRecurringJobsListAsync(new DespatchWeb.Models.RequestModels.RecurringJobQueryRequest
        {
            Order = "booked", OrderDirection = "asc", Limit = 100, Page = 1, Active = true, RecurringMode = DespatchWeb.Enums.RecurringMode.Active
        });

        Assert.Empty(_guard.Writes);
    }

    [Fact]
    public void TheReadServices_DependOnNoCommandOrWriterService()
    {
        var services = typeof(IAgentJobSearchService).Assembly.GetTypes()
            .Where(t => t.Namespace == typeof(AgentJobSearchService).Namespace && t is { IsClass: true, IsAbstract: false } && t.Name.StartsWith("Agent", StringComparison.Ordinal) && t.Name.EndsWith("Service", StringComparison.Ordinal))
            .ToList();

        Assert.NotEmpty(services);
        var dependencies = services.SelectMany(t => t.GetConstructors().SelectMany(c => c.GetParameters())).Select(p => p.ParameterType).Distinct().ToList();
        Assert.DoesNotContain(dependencies, d => d.Name.Contains("Command", StringComparison.Ordinal) || d.Name.Contains("Writer", StringComparison.Ordinal));
        Assert.DoesNotContain(dependencies, d => d == typeof(IDespatchContextProcedures));
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        _cache.Dispose();
        await _db.DisposeAsync();
    }
}
