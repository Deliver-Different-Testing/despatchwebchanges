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

    // IM writes every pairing row with OwnerTenantId = the local tenant, on both sides, so ownership can't say which
    // side sent a job. The receiver's copy is booked under the pairing's connected-tenant client; the sender's job
    // belongs to a real customer.
    private const int PairingClientId = 60;
    private const int CustomerClientId = 50;

    private static IntMgrPartnerPairing Pairing(int id, int? clientId = PairingClientId) => new()
    {
        Id = id,
        PartnerTenantId = "200",
        PartnerTenantName = "Partner Co",
        PartnerBaseUrl = "https://peer.example.com",
        Status = "Active",
        OwnerTenantId = "100",
        ClientId = clientId,
        CreatedAtUtc = DateTime.UtcNow,
        UpdatedAtUtc = DateTime.UtcNow
    };

    private async Task<bool> IsOutboundAsync(int? clientId, Guid? partnerJobGuid, int? pairingId, int? pairingClientId = PairingClientId)
    {
        await using var context = _db.CreateContext();
        if (pairingId is { } id)
        {
            context.IntMgrPartnerPairings.Add(Pairing(id, pairingClientId));
        }

        context.TucJobs.Add(new TucJob
        {
            UcjbId = 200,
            UcjbNumber = "JOB-200",
            UcjbClientId = clientId,
            PartnerJobGuid = partnerJobGuid,
            PartnerPairingId = pairingId
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);

        return await context.IsOutboundPartnerJobAsync(200);
    }

    [Fact]
    public async Task IsOutboundPartnerJobAsync_CustomerJobSentToPartner_ReturnsTrue() =>
        Assert.True(await IsOutboundAsync(CustomerClientId, Guid.NewGuid(), pairingId: 7));

    [Fact]
    public async Task IsOutboundPartnerJobAsync_InboundCopyBookedUnderPairingClient_ReturnsFalse() =>
        Assert.False(await IsOutboundAsync(PairingClientId, Guid.NewGuid(), pairingId: 7));

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PairingWithoutClient_ReturnsTrue() =>
        Assert.True(await IsOutboundAsync(CustomerClientId, Guid.NewGuid(), pairingId: 7, pairingClientId: null));

    [Fact]
    public async Task IsOutboundPartnerJobAsync_UnlinkedJobKeepingPairingId_ReturnsFalse() =>
        Assert.False(await IsOutboundAsync(CustomerClientId, partnerJobGuid: null, pairingId: 7));

    [Fact]
    public async Task IsOutboundPartnerJobAsync_PartnerJobWithoutPairingId_ReturnsFalse() =>
        Assert.False(await IsOutboundAsync(CustomerClientId, Guid.NewGuid(), pairingId: null));

    [Fact]
    public async Task IsOutboundPartnerJobAsync_NoMatchingJob_ReturnsFalse()
    {
        await using var context = _db.CreateContext();

        Assert.False(await context.IsOutboundPartnerJobAsync(999));
    }
}
