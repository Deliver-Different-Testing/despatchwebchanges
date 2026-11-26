using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// Shared SQLite fixture and seed rows for the Branches programme (B2) tests: two branches on their own sites, and
/// client / courier / suburb / job rows to place on them.
/// </summary>
public abstract class BranchScopedDbTest : IAsyncDisposable
{
    protected const int Sydney = 1;
    protected const int Melbourne = 2;
    protected const int SydneySite = 43;
    protected const int MelbourneSite = 44;

    protected readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    protected static CancellationToken Ct => TestContext.Current.CancellationToken;

    protected DespatchContext CreateContext(ScopeContext scope)
    {
        var provider = Substitute.For<IScopeProvider>();
        provider.Scope.Returns(scope);
        return new DespatchContext(_db.Options, provider);
    }

    protected async Task Seed(params object[] rows)
    {
        await using var seed = _db.CreateContext();
        seed.AddRange(rows);
        await seed.SaveChangesAsync(Ct);
    }

    protected async Task<int[]> JobIds(ScopeContext scope)
    {
        await using var context = CreateContext(scope);
        return await context.TucJobs.OrderBy(j => j.UcjbId).Select(j => j.UcjbId).ToArrayAsync(Ct);
    }

    protected static TucClient Client(int id, int? branchId, ClientType type = ClientType.Customer) => new()
    {
        UcclId = id, UcclName = $"Client {id}", UcclLegalName = "L", Smsname = "S", UcclCode = $"C{id}", UcclAddress = "1 St",
        UcclExtraAddress = "", UcclPostal = "", UcclPostCode = "0", UcclPhone = "", UcclPhone2 = "", UcclMobile = "", UcclFax = "",
        UcclType = "", Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T",
        ClientTypeId = (int)type, BranchId = branchId
    };

    protected static TucCourier Courier(int id, int? branchId) => new()
    {
        UccrId = id, Code = $"R{id}", UccrName = $"Courier{id}", UccrSurname = "X", UccrEmail = $"{id}@t.com", UccrMobile = "1",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", BranchId = branchId
    };

    protected static TucSuburb Suburb(int id, int? siteId) => new()
    {
        UcsuId = id, UcsuName = $"Suburb {id}", UcsuArea = 0, UcsuBaseRegion = 0, Smsname = "S", PostCode = "0",
        Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T", SiteId = siteId
    };

    protected static TucJob Job(int id, int? client = null, int? courier = null, int? from = null, int? to = null,
        int? parent = null, int? root = null) => new()
    {
        UcjbId = id, UcjbNumber = $"J{id}", UcjbClientId = client, UcjbCourierId = courier, UcjbFrom = from, UcjbTo = to,
        ParentId = parent, RootParentId = root
    };
}
