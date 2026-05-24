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
    public async Task IsOutboundPartnerJobAsync_JobWithDispatchRow_ReturnsTrue()
    {
        // Sender side: PartnerJobGuid is set AND a JobPartnerDispatch row links the
        // job to the outbound pairing.
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
            PartnerJobGuid = Guid.NewGuid()
        });
        context.JobPartnerDispatches.Add(new JobPartnerDispatch
        {
            JobId = 200,
            PartnerPairingId = 7
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsOutboundPartnerJobAsync(200);

        Assert.True(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PartnerJobWithoutDispatchRow_ReturnsFalse()
    {
        // Receiver side: PartnerJobGuid is set but no JobPartnerDispatch row, so the
        // courier slot is local and the outbound guard must not fire.
        await using var context = _db.CreateContext();
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 201,
            UcjbNumber = "JOB-201",
            PartnerJobGuid = Guid.NewGuid()
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var result = await context.IsOutboundPartnerJobAsync(201);

        Assert.False(result);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_NoMatchingJob_ReturnsFalse()
    {
        await using var context = _db.CreateContext();

        var result = await context.IsOutboundPartnerJobAsync(999);

        Assert.False(result);
    }
}
