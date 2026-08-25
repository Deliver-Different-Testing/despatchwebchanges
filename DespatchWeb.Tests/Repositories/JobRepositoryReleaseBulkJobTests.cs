using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Releasing a bulk family used to walk ParentId while voiding and the related-jobs lookups walked
/// BulkParentId, so a leg hung off the other column was silently left behind — dispatch could not get
/// the parent and DEL out of bulk. Eligibility also keyed off Done, which records that a row has
/// already been pushed live rather than that it was delivered, and ignored Void entirely.
/// </summary>
public class JobRepositoryReleaseBulkJobTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDespatchContextProcedures _proceduresMock = Substitute.For<IDespatchContextProcedures>();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryReleaseBulkJobTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock(_proceduresMock);
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(Arg.Any<TimeZone>()).Returns(TestDates.Now);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task ReleaseBulkJobByIdAsync_ChildLinkedByBulkParentId_IsReleasedWithTheParent()
    {
        // Arrange - the DEL leg hangs off BulkParentId with ParentId null, which the old release
        // query could not see
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.AddRange(
                CreateBulkJob(1, "BULK-001"),
                CreateBulkJob(2, "BULK-001DEL", bulkParentId: 1));
            SeedLiveJobsFor(context, "BULK-001", "BULK-001DEL");
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var released = await repository.ReleaseBulkJobByIdAsync(1);

        // Assert
        Assert.Equal(2, released.Count);
        Assert.Contains("BULK-001DEL", released);
    }

    [Fact]
    public async Task ReleaseBulkJobByIdAsync_ChildLinkedByParentId_IsStillReleased()
    {
        // Arrange - families linked the other way must keep working
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.AddRange(
                CreateBulkJob(1, "BULK-001"),
                CreateBulkJob(2, "BULK-001DEL", parentId: 1));
            SeedLiveJobsFor(context, "BULK-001", "BULK-001DEL");
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var released = await repository.ReleaseBulkJobByIdAsync(1);

        // Assert
        Assert.Equal(2, released.Count);
    }

    [Fact]
    public async Task ReleaseBulkJobByIdAsync_AlreadyReleasedChild_IsNotReleasedAgain()
    {
        // Arrange - Done plus a JobId is what the release proc stamps on a row it has pushed live
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.AddRange(
                CreateBulkJob(1, "BULK-001"),
                CreateBulkJob(2, "BULK-001DEL", bulkParentId: 1, released: true, liveJobId: 500));
            SeedLiveJobsFor(context, "BULK-001", "BULK-001DEL");
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var released = await repository.ReleaseBulkJobByIdAsync(1);

        // Assert
        Assert.Equal(["BULK-001"], released);
    }

    [Fact]
    public async Task ReleaseBulkJobByIdAsync_VoidedChild_IsNotPushedLive()
    {
        // Arrange - a voided row was still releasable because eligibility only looked at Done
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.AddRange(
                CreateBulkJob(1, "BULK-001"),
                CreateBulkJob(2, "BULK-001DEL", bulkParentId: 1, isVoid: true));
            SeedLiveJobsFor(context, "BULK-001", "BULK-001DEL");
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var released = await repository.ReleaseBulkJobByIdAsync(1);

        // Assert
        Assert.Equal(["BULK-001"], released);
    }

    [Fact]
    public async Task ReleaseBulkJobByIdAsync_WholeFamilyAlreadyReleased_ExplainsThatRatherThanClaimingDone()
    {
        // Arrange
        await using (var context = _db.CreateContext())
        {
            context.TblBulkJobs.Add(CreateBulkJob(1, "BULK-001", released: true, liveJobId: 500));
            SeedLiveJobsFor(context, "BULK-001");
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var exception = await Assert.ThrowsAsync<InvalidOperationException>(
            () => repository.ReleaseBulkJobByIdAsync(1));

        // Assert - "Done" reads as delivered to an operator; the row is merely already live
        Assert.Contains("released", exception.Message, StringComparison.OrdinalIgnoreCase);
        Assert.DoesNotContain("Done", exception.Message, StringComparison.Ordinal);
    }

    private static void SeedLiveJobsFor(DespatchContext context, params string[] jobNumbers)
    {
        // The release proc is mocked, so stand in the live rows its insert would have produced —
        // ReleaseBulkJobByIdAsync verifies they exist before committing.
        var id = 500;
        foreach (var jobNumber in jobNumbers)
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = id++,
                UcjbNumber = jobNumber,
                UcjbDate = TestDates.Now.Date,
                UcjbTime = TestDates.Now.Date.AddHours(9),
                UcjbStatus = (int)JobStatus.New
            });
        }
    }

    private static TblBulkJob CreateBulkJob(
        int id,
        string jobNumber,
        int? parentId = null,
        int? bulkParentId = null,
        bool released = false,
        bool isVoid = false,
        int? liveJobId = null) =>
        new()
        {
            BulkJobId = id,
            JobNumber = jobNumber,
            ClientCode = "TST",
            BookDate = TestDates.Now.Date,
            BookTime = TestDates.Now.Date.AddHours(9),
            JobStatus = (int)JobStatus.New,
            ParentId = parentId,
            BulkParentId = bulkParentId,
            Done = released,
            Void = isVoid,
            JobId = liveJobId
        };
}
