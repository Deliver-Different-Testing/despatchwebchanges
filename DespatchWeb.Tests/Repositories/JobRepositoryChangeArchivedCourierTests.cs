using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Exceptions;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for changing the paid courier on an archived job:
/// ChangeArchivedJobCourierAsync (command) and GetArchivedCourierChangeEligibilityAsync (query).
/// The change must only reassign UcjbCourierId — never payment/settlement fields — and must be
/// refused once the job is invoiced (UcjbInvoiceNo or a done InvoiceProcess) or the courier
/// has been settled (CourierSettlementBatchId).
/// </summary>
public class JobRepositoryChangeArchivedCourierTests : IAsyncDisposable
{
    private const int OldCourierId = 10;
    private const int NewCourierId = 20;
    private const int InactiveCourierId = 30;

    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryChangeArchivedCourierTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();
        _tenantInfoServiceMock.GetStaffId().Returns(1);

        using var context = _db.CreateContext();
        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = OldCourierId, Code = "OLD", UccrName = "Olive", UccrSurname = "Old",
                UccrEmail = "old@t.com", UccrMobile = "1", Active = true,
                Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
            },
            new TucCourier
            {
                UccrId = NewCourierId, Code = "NEW", UccrName = "Nina", UccrSurname = "New",
                UccrEmail = "new@t.com", UccrMobile = "2", Active = true,
                Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
            },
            new TucCourier
            {
                UccrId = InactiveCourierId, Code = "GONE", UccrName = "Ivan", UccrSurname = "Inactive",
                UccrEmail = "gone@t.com", UccrMobile = "3", Active = false,
                Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
            });
        context.SaveChanges();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext() => _db.CreateContext();

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        Substitute.For<IClearListEnvelopeService>(),
        Substitute.For<ICreateJobService>(),
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    private void SeedArchivedJob(Action<TucJobArchive>? customise = null)
    {
        using var context = CreateContext();
        var archive = new TucJobArchive
        {
            UcjbId = 1,
            UcjbNumber = "JOB-001",
            UcjbJobDone = true,
            UcjbStatus = (int)JobStatus.Completed,
            UcjbCourierId = OldCourierId,
            CourierPayment = 42.50m,
            CourierBonus = 5.00m,
            CourierFuel = 3.25m
        };
        customise?.Invoke(archive);
        context.TucJobArchives.Add(archive);
        context.SaveChanges();
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_HappyPath_ReassignsCourierOnly()
    {
        SeedArchivedJob();
        var repository = CreateRepository();

        await repository.ChangeArchivedJobCourierAsync(1, NewCourierId);

        await using var verifyContext = CreateContext();
        var archive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 1,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(NewCourierId, archive.UcjbCourierId);
        Assert.Equal(42.50m, archive.CourierPayment);
        Assert.Equal(5.00m, archive.CourierBonus);
        Assert.Equal(3.25m, archive.CourierFuel);
        Assert.Null(archive.CourierSettlementBatchId);
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_WritesAuditNote()
    {
        SeedArchivedJob();
        var repository = CreateRepository();

        await repository.ChangeArchivedJobCourierAsync(1, NewCourierId);

        await using var verifyContext = CreateContext();
        var note = await verifyContext.TucNotes.SingleAsync(
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(1, note.JobBookingId); // archived jobs note via JobBookingId, not JobId
        Assert.Null(note.JobId);
        Assert.Contains("OLD", note.NoteText);
        Assert.Contains("NEW", note.NoteText);
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_AlreadyInvoiced_InvoiceNo_Throws()
    {
        SeedArchivedJob(a => a.UcjbInvoiceNo = 555);
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(1, NewCourierId));

        await using var verifyContext = CreateContext();
        var archive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 1,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(OldCourierId, archive.UcjbCourierId);
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_AlreadyInvoiced_InvoiceProcessDone_Throws()
    {
        SeedArchivedJob(a => a.InvoiceProcess = new TucInvoiceProcess
        {
            UcipId = 7,
            UcipDateTo = TestDates.Now,
            UcipDone = true
        });
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(1, NewCourierId));
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_PendingInvoiceProcess_NotDone_Succeeds()
    {
        SeedArchivedJob(a => a.InvoiceProcess = new TucInvoiceProcess
        {
            UcipId = 7,
            UcipDateTo = TestDates.Now,
            UcipDone = false
        });
        var repository = CreateRepository();

        await repository.ChangeArchivedJobCourierAsync(1, NewCourierId);

        await using var verifyContext = CreateContext();
        var archive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 1,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(NewCourierId, archive.UcjbCourierId);
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_CourierSettled_Throws()
    {
        SeedArchivedJob(a => a.CourierSettlementBatchId = 99);
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(1, NewCourierId));
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_JobNotInArchive_Throws()
    {
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(404, NewCourierId));
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_UnknownCourier_Throws()
    {
        SeedArchivedJob();
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(1, 12345));
    }

    [Fact]
    public async Task ChangeArchivedJobCourier_InactiveCourier_Throws()
    {
        SeedArchivedJob();
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArchivedCourierChangeException>(
            () => repository.ChangeArchivedJobCourierAsync(1, InactiveCourierId));
    }

    [Fact]
    public async Task GetEligibility_NotArchived_ReturnsNull()
    {
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(404);

        Assert.Null(eligibility);
    }

    [Fact]
    public async Task GetEligibility_CleanArchivedJob_IsChangeable()
    {
        SeedArchivedJob();
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(1);

        Assert.NotNull(eligibility);
        Assert.False(eligibility.IsInvoiced);
        Assert.False(eligibility.IsSettled);
        Assert.True(eligibility.IsDone);
        Assert.Equal(OldCourierId, eligibility.CurrentCourierId);
        Assert.Equal("Olive Old", eligibility.CurrentCourierName);
    }

    [Fact]
    public async Task GetEligibility_InvoiceNo_ReportsInvoiced()
    {
        SeedArchivedJob(a => a.UcjbInvoiceNo = 555);
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(1);

        Assert.NotNull(eligibility);
        Assert.True(eligibility.IsInvoiced);
    }

    [Fact]
    public async Task GetEligibility_InvoiceProcessDone_ReportsInvoiced()
    {
        SeedArchivedJob(a => a.InvoiceProcess = new TucInvoiceProcess
        {
            UcipId = 7,
            UcipDateTo = TestDates.Now,
            UcipDone = true
        });
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(1);

        Assert.NotNull(eligibility);
        Assert.True(eligibility.IsInvoiced);
    }

    [Fact]
    public async Task GetEligibility_SettlementBatch_ReportsSettled()
    {
        SeedArchivedJob(a => a.CourierSettlementBatchId = 99);
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(1);

        Assert.NotNull(eligibility);
        Assert.True(eligibility.IsSettled);
    }

    [Fact]
    public async Task GetEligibility_NoCourierAssigned_ReturnsNullCourier()
    {
        SeedArchivedJob(a => a.UcjbCourierId = null);
        var repository = CreateRepository();

        var eligibility = await repository.GetArchivedCourierChangeEligibilityAsync(1);

        Assert.NotNull(eligibility);
        Assert.Null(eligibility.CurrentCourierId);
        Assert.Null(eligibility.CurrentCourierName);
    }
}
