using DespatchWeb.EntityClasses;

namespace DespatchWeb.Tests.Repositories;

public class DespatchContextPartnerJobTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task IsPartnerJobAsync_LiveJobWithPartnerGuid_ReturnsTrue()
    {
        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 100,
            UcjbNumber = "JOB-100",
            PartnerJobGuid = Guid.NewGuid()
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsPartnerJobAsync(100);

        Assert.True(result);
    }

    [Fact]
    public async Task IsPartnerJobAsync_LiveJobWithoutPartnerGuid_ReturnsFalse()
    {
        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 101,
            UcjbNumber = "JOB-101",
            PartnerJobGuid = null
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsPartnerJobAsync(101);

        Assert.False(result);
    }

    [Fact]
    public async Task IsPartnerJobAsync_ArchivedJobWithPartnerGuid_ReturnsTrue()
    {
        await using var context = _db.CreateContext();
        context.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = 102,
            UcjbNumber = "JOB-102",
            PartnerJobGuid = Guid.NewGuid()
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsPartnerJobAsync(102);

        Assert.True(result);
    }

    [Fact]
    public async Task IsPartnerJobAsync_NoMatchingRow_ReturnsFalse()
    {
        await using var context = _db.CreateContext();

        var result = await context.IsPartnerJobAsync(999);

        Assert.False(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PairingOwnedByLocalTenant_ReturnsTrue()
    {
        // Sender side: the linked pairing's OwnerTenantId matches the local tenant.
        await using var context = _db.CreateContext();
        context.IntMgrPartnerPairings.Add(new IntMgrPartnerPairing
        {
            Id = 7,
            PartnerTenantId = "200",
            PartnerTenantName = "Partner Co",
            PartnerBaseUrl = "https://peer.example.com",
            Status = "Active",
            OwnerTenantId = "100",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        });
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 200,
            UcjbNumber = "JOB-200",
            PartnerJobGuid = Guid.NewGuid(),
            PartnerPairingId = 7
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsOutboundPartnerJobAsync(200, localTenantId: "100");

        Assert.True(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PairingOwnedByOtherTenant_ReturnsFalse()
    {
        // Receiver side: the linked pairing's OwnerTenantId is the originating partner,
        // not us. Outbound guard must not fire.
        await using var context = _db.CreateContext();
        context.IntMgrPartnerPairings.Add(new IntMgrPartnerPairing
        {
            Id = 8,
            PartnerTenantId = "100",
            PartnerTenantName = "Our Tenant",
            PartnerBaseUrl = "https://us.example.com",
            Status = "Active",
            OwnerTenantId = "200",
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        });
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 201,
            UcjbNumber = "JOB-201",
            PartnerJobGuid = Guid.NewGuid(),
            PartnerPairingId = 8
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsOutboundPartnerJobAsync(201, localTenantId: "100");

        Assert.False(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PartnerJobWithoutPairingId_ReturnsFalse()
    {
        // Stale-link case: partner job whose source pairing isn't recorded
        // (e.g. created before TucJob.PartnerPairingId was populated). The
        // outbound guard returns false so the controller's other partner
        // guards still apply.
        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 202,
            UcjbNumber = "JOB-202",
            PartnerJobGuid = Guid.NewGuid()
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsOutboundPartnerJobAsync(202, localTenantId: "100");

        Assert.False(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_NullOrEmptyLocalTenantId_ReturnsFalse()
    {
        // Defensive: a missing tenant id means we can't tell which side of the
        // pairing we're on. Treat as non-outbound (matches the legacy
        // JobPartnerDispatch-row check which returned false for missing rows).
        await using var context = _db.CreateContext();

        Assert.False(await context.IsOutboundPartnerJobAsync(999, localTenantId: null));
        Assert.False(await context.IsOutboundPartnerJobAsync(999, localTenantId: ""));
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_NoMatchingJob_ReturnsFalse()
    {
        await using var context = _db.CreateContext();

        var result = await context.IsOutboundPartnerJobAsync(999, localTenantId: "100");

        Assert.False(result);
    }
}
