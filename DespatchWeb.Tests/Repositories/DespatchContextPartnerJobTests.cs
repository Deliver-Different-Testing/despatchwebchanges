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
}
