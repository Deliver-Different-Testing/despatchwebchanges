using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Moving an archived job to another client. Once a job is invoiced, the
/// tucJobArchive_Update_BlockChanges trigger refuses the change for every caller but Accounts,
/// so the repository refuses it first with a message a dispatcher can act on.
/// </summary>
public class JobRepositoryEditArchivedClientTests : IAsyncDisposable
{
    private const int OldClientId = 10;
    private const int NewClientId = 20;

    private readonly SqliteTestDatabase _db = new();
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();

    public JobRepositoryEditArchivedClientTests()
    {
        using var context = _db.CreateContext();
        context.TucClients.AddRange(CreateClient(OldClientId, "OLDCL"), CreateClient(NewClientId, "NEWCL"));
        context.SaveChanges();
    }

    private static TucClient CreateClient(int id, string code) => new()
    {
        UcclId = id,
        UcclCode = code,
        UcclName = code,
        UcclLegalName = code,
        Smsname = code,
        CreatedBy = "test",
        LastModifiedBy = "test"
    };

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _db.CreateFactoryMock(),
        _tenantInfoService,
        new FakeTenantClock(TestDates.Now),
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>());

    private async Task SeedArchiveAsync(int jobId, int? invoiceNo, int? originalInvoiceId = null)
    {
        await using var context = _db.CreateContext();
        context.TucJobArchives.Add(new TucJobArchive
        {
            UcjbId = jobId,
            UcjbNumber = $"E{jobId}FHS",
            UcjbClientId = OldClientId,
            UcjbClientCode = "OLDCL",
            UcjbInvoiceNo = invoiceNo,
            OriginalInvoiceId = originalInvoiceId
        });
        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task<TucJobArchive> ReadArchiveAsync(int jobId)
    {
        await using var context = _db.CreateContext();
        return await context.TucJobArchives.SingleAsync(j => j.UcjbId == jobId,
            TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task UpdateJobAsync_ClientId_InvoicedArchivedJob_IsRefusedAndClientUnchanged()
    {
        await SeedArchiveAsync(1, invoiceNo: 5001);

        var ex = await Assert.ThrowsAsync<ArchivedClientChangeException>(() =>
            CreateRepository().UpdateJobAsync(1, JobProperty.ClientID, NewClientId.ToString()));

        Assert.Contains("E1FHS", ex.Message);
        Assert.Contains("invoiced", ex.Message);
        var archive = await ReadArchiveAsync(1);
        Assert.Equal(OldClientId, archive.UcjbClientId);
        Assert.Equal("OLDCL", archive.UcjbClientCode);
    }

    [Theory]
    [InlineData(null, null)]      // not invoiced
    [InlineData(0, null)]         // legacy "0" invoice number means not invoiced
    [InlineData(5001, 77)]        // in suspense for reissue - the trigger lets it through
    public async Task UpdateJobAsync_ClientId_ArchivedJobTheTriggerAllows_MovesClient(int? invoiceNo,
        int? originalInvoiceId)
    {
        await SeedArchiveAsync(2, invoiceNo, originalInvoiceId);

        await CreateRepository().UpdateJobAsync(2, JobProperty.ClientID, NewClientId.ToString());

        var archive = await ReadArchiveAsync(2);
        Assert.Equal(NewClientId, archive.UcjbClientId);
        Assert.Equal("NEWCL", archive.UcjbClientCode);
    }
}
