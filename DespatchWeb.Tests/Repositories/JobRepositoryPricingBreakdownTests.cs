using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository pricing breakdown operations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class JobRepositoryPricingBreakdownTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPricingBreakdownTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);

        _context.TucNoteTypes.Add(new TucNoteType
        {
            NoteTypeId = 1,
            NoteTypeName = "Internal Note",
            IsActive = true,
            IsPublic = false,
            IsSystemDefined = true
        });
        _context.SaveChanges();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock,
        Substitute.For<ICourierRepository>(),
        Substitute.For<ISuburbResolver>()
    );

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithLiveJob_ReturnsBreakdowns()
    {
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Base Charge", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Fuel Surcharge", 15.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Base Charge" && b.Amount == 100.00m);
        Assert.Contains(result, b => b.Name == "Fuel Surcharge" && b.Amount == 15.00m);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithArchivedJob_ReturnsArchiveBreakdowns()
    {
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.AddRange(
            CreatePricingBreakdownArchive(1, jobId, "Base Charge", 200.00m),
            CreatePricingBreakdownArchive(2, jobId, "Fuel Surcharge", 25.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: true);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Base Charge" && b.Amount == 200.00m);
        Assert.Contains(result, b => b.Name == "Fuel Surcharge" && b.Amount == 25.00m);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithPrebookJob_ReturnsPrebookBreakdowns()
    {
        const int prebookId = 100;
        _context.TucJobBookings.Add(CreatePrebookJob(prebookId, "PREBOOK001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, null, prebookId, "Prebook Base", 150.00m),
            CreatePricingBreakdown(2, null, prebookId, "Prebook Surcharge", 20.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(prebookId, isPrebook: true, isArchived: false);

        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Prebook Base" && b.Amount == 150.00m);
        Assert.Contains(result, b => b.PrebookJobId == prebookId);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithNoBreakdowns_ReturnsEmptyList()
    {
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_OnlyReturnsBreakdownsForSpecificJob()
    {
        const int jobId1 = 100;
        const int jobId2 = 101;
        _context.TucJobs.AddRange(
            CreateJob(jobId1, "JOB001"),
            CreateJob(jobId2, "JOB002")
        );
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId1, null, "Job 1 Charge", 100.00m),
            CreatePricingBreakdown(2, jobId2, null, "Job 2 Charge", 200.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(jobId1, isPrebook: false, isArchived: false);

        Assert.Single(result);
        Assert.Equal("Job 1 Charge", result[0].Name);
    }


    [Fact]
    public async Task GetJobPriceBreakdownAsync_ForSplitLeg_ReturnsOnlyThatLegsLines()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            CreateSplitParent(parentId, "KT1314V"),
            CreateSplitLeg(legA, "KT1314VA", parentId),
            CreateSplitLeg(legB, "KT1314VB", parentId));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base Part A", 44.80m, 22.40m, legA),
            CreatePricingBreakdown(2, parentId, null, "Congestion Part A", 6.30m, 4.20m, legA),
            CreatePricingBreakdown(3, parentId, null, "Base Part B", 19.20m, 9.60m, legB),
            CreatePricingBreakdown(4, parentId, null, "Congestion Part B", 2.70m, 1.80m, legB));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var legAResult = await repository.GetJobPriceBreakdownAsync(legA, isPrebook: false, isArchived: false);
        var legBResult = await repository.GetJobPriceBreakdownAsync(legB, isPrebook: false, isArchived: false);
        var parentResult = await repository.GetJobPriceBreakdownAsync(parentId, isPrebook: false, isArchived: false);

        Assert.Equal(["Base Part A", "Congestion Part A"], legAResult.Select(r => r.Name).Order());
        Assert.Equal(51.10m, legAResult.Sum(r => r.Amount));
        Assert.Equal(["Base Part B", "Congestion Part B"], legBResult.Select(r => r.Name).Order());
        Assert.Equal(21.90m, legBResult.Sum(r => r.Amount));

        Assert.Equal(4, parentResult.Count);
        Assert.Equal(73.00m, parentResult.Sum(r => r.Amount));
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_ForLegacySplitLeg_StillFallsBackToTheParentsLines()
    {
        const int parentId = 100;
        const int legA = 101;
        _context.TucJobs.AddRange(
            CreateSplitParent(parentId, "OLD001"),
            CreateSplitLeg(legA, "OLD001A", parentId));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base", 64.00m, 32.00m),
            CreatePricingBreakdown(2, parentId, null, "Congestion", 9.00m, 6.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(legA, isPrebook: false, isArchived: false);

        Assert.Equal(["Base", "Congestion"], result.Select(r => r.Name).Order());
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_ForNewModelSplitLeg_ReturnsItsDerivedAllocationRows()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            CreateSplitParent(parentId, "KT4071V"),
            CreateSplitLeg(legA, "KT4071VA", parentId),
            CreateSplitLeg(legB, "KT4071VB", parentId));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base", 64.00m, 32.00m),
            CreatePricingBreakdown(2, parentId, null, "Congestion", 9.00m, 6.00m));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 80m, ChargeAmount = 51.20m, CostAmount = 25.60m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 20m, ChargeAmount = 12.80m, CostAmount = 6.40m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legA, SharePercent = 80m, ChargeAmount = 7.20m, CostAmount = 4.80m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legB, SharePercent = 20m, ChargeAmount = 1.80m, CostAmount = 1.20m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var legAResult = await repository.GetJobPriceBreakdownAsync(legA, isPrebook: false, isArchived: false);
        var legBResult = await repository.GetJobPriceBreakdownAsync(legB, isPrebook: false, isArchived: false);
        var parentResult = await repository.GetJobPriceBreakdownAsync(parentId, isPrebook: false, isArchived: false);

        Assert.Equal(["Base", "Congestion"], legAResult.Select(r => r.Name).Order());
        Assert.Equal(58.40m, legAResult.Sum(r => r.Amount));
        Assert.Equal(30.40m, legAResult.Sum(r => r.CostAmount));

        Assert.Equal(["Base", "Congestion"], legBResult.Select(r => r.Name).Order());
        Assert.Equal(14.60m, legBResult.Sum(r => r.Amount));

        Assert.Equal(2, parentResult.Count);
        Assert.Equal(73.00m, parentResult.Sum(r => r.Amount));
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_ForSplitLegWithNoLinesOfItsOwn_ReturnsEmpty()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            CreateSplitParent(parentId, "KT1314V"),
            CreateSplitLeg(legA, "KT1314VA", parentId),
            CreateSplitLeg(legB, "KT1314VB", parentId));
        _context.PricingBreakdowns.Add(
            CreatePricingBreakdown(1, parentId, null, "Base Part A", 89.00m, 50.00m, legA));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(legB, isPrebook: false, isArchived: false);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithNonExistentArchivedJob_ReturnsEmptyList()
    {
        var repository = CreateRepository();

        var result = await repository.GetJobPriceBreakdownAsync(999, isPrebook: false, isArchived: true);

        Assert.Empty(result);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithLiveJob_AddsToLiveTable()
    {
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "New Charge",
            Amount = 50.00m,
            ChildJobId = jobId,
            CostAmount = 25.00m
        };

        var repository = CreateRepository();

        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        Assert.True(chargeId > 0);
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(breakdown);
        Assert.Equal("New Charge", breakdown.ChargeName);
        Assert.Equal(50.00m, breakdown.ChargeAmount);
        Assert.Equal(jobId, breakdown.JobId);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithArchivedJob_AddsToArchiveTable()
    {
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "Archive Charge",
            Amount = 75.00m,
            ChildJobId = jobId,
            CostAmount = 30.00m
        };

        var repository = CreateRepository();

        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: true);

        Assert.True(chargeId > 0);
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(breakdown);
        Assert.Equal("Archive Charge", breakdown.ChargeName);
        Assert.Equal(75.00m, breakdown.ChargeAmount);
        Assert.Equal(jobId, breakdown.JobId);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithPrebookJob_AddsToPrebookBreakdowns()
    {
        const int prebookId = 100;
        _context.TucJobBookings.Add(CreatePrebookJob(prebookId, "PREBOOK001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "Prebook Charge",
            Amount = 60.00m,
            PrebookJobId = prebookId,
            CostAmount = 35.00m
        };

        var repository = CreateRepository();

        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        Assert.True(chargeId > 0);
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(breakdown);
        Assert.Equal("Prebook Charge", breakdown.ChargeName);
        Assert.Equal(prebookId, breakdown.PrebookJobId);
        Assert.Null(breakdown.JobId);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithNoJobOrPrebook_ReturnsZero()
    {
        var viewModel = new ChargeViewModel
        {
            Name = "Invalid Charge",
            Amount = 50.00m
        };

        var repository = CreateRepository();

        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        Assert.Equal(0, chargeId);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithLiveJob_UpdatesBreakdown()
    {
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(chargeId, jobId, null, "Original", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            ChargeId = chargeId,
            JobId = jobId,
            Name = "Updated",
            Amount = 150.00m,
            CostAmount = 50.00m
        };

        var repository = CreateRepository();

        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(breakdown);
        Assert.Equal("Updated", breakdown.ChargeName);
        Assert.Equal(150.00m, breakdown.ChargeAmount);
        Assert.Equal(50.00m, breakdown.CostAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithArchivedJob_UpdatesArchiveBreakdown()
    {
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(chargeId, jobId, "Original", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            ChargeId = chargeId,
            JobId = jobId,
            Name = "Updated Archive",
            Amount = 175.00m,
            CostAmount = 60.00m
        };

        var repository = CreateRepository();

        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: true);

        _context.ChangeTracker.Clear();
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotNull(breakdown);
        Assert.Equal("Updated Archive", breakdown.ChargeName);
        Assert.Equal(175.00m, breakdown.ChargeAmount);
        Assert.Equal(60.00m, breakdown.CostAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithNoJobOrPrebook_DoesNothing()
    {
        var viewModel = new ChargeViewModel
        {
            ChargeId = 1,
            Name = "Invalid Update",
            Amount = 50.00m
        };

        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        async Task Act() => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithNonExistentChargeId_DoesNothing()
    {
        var viewModel = new ChargeViewModel
        {
            ChargeId = 999,
            JobId = 100,
            Name = "Non-existent",
            Amount = 50.00m
        };

        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        async Task Act() => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLiveBreakdown_DeletesFromLiveTable()
    {
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(chargeId, jobId, null, "To Delete", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: false);

        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(breakdown);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithArchivedBreakdown_DeletesFromArchiveTable()
    {
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(chargeId, jobId, "Archive To Delete", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: true);

        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(breakdown);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithNonExistentChargeId_DoesNotThrow()
    {
        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        async Task Act() => await repository.DeleteJobPriceBreakdownAsync(999, isArchived: false);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_OnlyDeletesSpecificBreakdown()
    {
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Keep", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Delete", 200.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        var remaining = await _context.PricingBreakdowns.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal("Keep", remaining.First().ChargeName);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithLiveJob_SyncsUcjbAmountToBreakdownSum()
    {
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 0m });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, jobId, null, "Existing", 50.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "New Charge",
            Amount = 75.00m,
            ChildJobId = jobId,
            CostAmount = 25.00m
        };

        var repository = CreateRepository();

        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(125.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithArchivedJob_SyncsUcjbAmountToBreakdownSum()
    {
        const int jobId = 100;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH001", UcjbAmount = 0m });
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(1, jobId, "Existing", 80.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "Archive Charge",
            Amount = 45.00m,
            ChildJobId = jobId,
            CostAmount = 20.00m
        };

        var repository = CreateRepository();

        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: true);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(125.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithPrebookJob_SyncsUcbkAmountToBreakdownSum()
    {
        const int prebookId = 100;
        _context.TucJobBookings.Add(new TucJobBooking { UcbkId = prebookId, UcbkJobNumber = "PB001", UcbkAmount = 0m });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, null, prebookId, "Existing", 30.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            Name = "New Prebook Charge",
            Amount = 90.00m,
            PrebookJobId = prebookId,
            CostAmount = 40.00m
        };

        var repository = CreateRepository();

        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var booking = await _context.TucJobBookings.FirstAsync(j => j.UcbkId == prebookId, TestContext.Current.CancellationToken);
        Assert.Equal(120.00m, booking.UcbkAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithLiveJob_SyncsUcjbAmountToNewSum()
    {
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 150.00m });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Line A", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Line B", 50.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            ChargeId = 1,
            JobId = jobId,
            Name = "Line A",
            Amount = 200.00m,
            CostAmount = 80.00m
        };

        var repository = CreateRepository();

        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(250.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithArchivedJob_SyncsUcjbAmountToNewSum()
    {
        const int jobId = 100;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH001", UcjbAmount = 100.00m });
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(1, jobId, "Existing", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var viewModel = new ChargeViewModel
        {
            ChargeId = 1,
            JobId = jobId,
            Name = "Existing",
            Amount = 175.00m,
            CostAmount = 60.00m
        };

        var repository = CreateRepository();

        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: true);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(175.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLiveBreakdown_SyncsUcjbAmountToRemainingSum()
    {
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 150.00m });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Keep", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Remove", 50.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(100.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithArchivedBreakdown_SyncsUcjbAmountToRemainingSum()
    {
        const int jobId = 100;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH001", UcjbAmount = 200.00m });
        _context.PricingBreakdownArchives.AddRange(
            CreatePricingBreakdownArchive(1, jobId, "Keep", 120.00m),
            CreatePricingBreakdownArchive(2, jobId, "Remove", 80.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: true);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(120.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLastLiveBreakdown_ZeroesUcjbAmount()
    {
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 100.00m });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, jobId, null, "Only line", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(1, isArchived: false);

        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(0m, job.UcjbAmount);
    }


    [Fact]
    public async Task AddJobPriceBreakdownAsync_OnSplitChild_Throws()
    {
        const int parentId = 100;
        const int legId = 101;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legId, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new ChargeViewModel { Name = "New Charge", Amount = 10.00m, ChildJobId = legId };

        await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false));

        Assert.Empty(await _context.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_OnSplitParent_SeedsAllocationRowOnEveryCurrentLeg()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", 100.00m));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 50m, ChargeAmount = 50.00m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 50m, ChargeAmount = 50.00m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new ChargeViewModel { Name = "Congestion", Amount = 20.00m, ChildJobId = parentId };

        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var allocations = await _context.PricingBreakdownAllocations
            .Where(a => a.ParentPricingBreakdownId == chargeId)
            .ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(2, allocations.Count);
        Assert.Equal(20.00m, allocations.Sum(a => a.ChargeAmount));

        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        var legBJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legB, TestContext.Current.CancellationToken);
        Assert.Equal(60.00m, legAJob.UcjbAmount);
        Assert.Equal(60.00m, legBJob.UcjbAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_OnSplitChild_Throws()
    {
        const int parentId = 100;
        const int legId = 101;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legId, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new ChargeViewModel { ChargeId = 1, Name = "Base", Amount = 999.00m, JobId = parentId, ChildJobId = legId };

        await Assert.ThrowsAsync<InvalidOperationException>(
            async () => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false));

        _context.ChangeTracker.Clear();
        var item = await _context.PricingBreakdowns.FirstAsync(p => p.PricingBreakdownId == 1, TestContext.Current.CancellationToken);
        Assert.Equal(100.00m, item.ChargeAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_OnSplitParent_RewritesLegHeadersFromTheNewAmount()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", 100.00m));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 70m, ChargeAmount = 70.00m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 30m, ChargeAmount = 30.00m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var viewModel = new ChargeViewModel { ChargeId = 1, Name = "Base", Amount = 200.00m, JobId = parentId };

        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);

        _context.ChangeTracker.Clear();
        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        var legBJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legB, TestContext.Current.CancellationToken);
        Assert.Equal(140.00m, legAJob.UcjbAmount);
        Assert.Equal(60.00m, legBJob.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_OnLegacySplitChildRow_DeletesAndRecalculatesLegAmount()
    {
        const int parentId = 100;
        const int legId = 101;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent, UcjbAmount = 80.00m },
            new TucJob { UcjbId = legId, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, UcjbAmount = 80.00m });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base Part A", 50.00m, childJobId: legId),
            CreatePricingBreakdown(2, parentId, null, "Fuel Part A", 30.00m, childJobId: legId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        _context.ChangeTracker.Clear();
        Assert.Equal(1, await _context.PricingBreakdowns.CountAsync(TestContext.Current.CancellationToken));
        var legJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legId, TestContext.Current.CancellationToken);
        Assert.Equal(50.00m, legJob.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_OnArchivedLegacySplitChildRow_Deletes()
    {
        const int parentId = 100;
        const int legId = 101;
        _context.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJobArchive { UcjbId = legId, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdownArchives.Add(
            CreatePricingBreakdownArchive(1, parentId, "Base Part A", 50.00m, childJobId: legId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(1, isArchived: true);

        Assert.Empty(await _context.PricingBreakdownArchives.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_OnSplitParent_RewritesLegHeadersExcludingTheRemovedItem()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base", 100.00m),
            CreatePricingBreakdown(2, parentId, null, "Congestion", 20.00m));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 50m, ChargeAmount = 50.00m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 50m, ChargeAmount = 50.00m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legA, SharePercent = 50m, ChargeAmount = 10.00m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legB, SharePercent = 50m, ChargeAmount = 10.00m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        _context.ChangeTracker.Clear();
        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        var legBJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legB, TestContext.Current.CancellationToken);

        Assert.Equal(50.00m, legAJob.UcjbAmount);
        Assert.Equal(50.00m, legBJob.UcjbAmount);
    }

    [Fact]
    public async Task GetSplitPricingLockStateAsync_LiveParentAndLegs_EverythingUnlocked()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var state = await repository.GetSplitPricingLockStateAsync(parentId);

        Assert.False(state.RevenueLocked);
        Assert.Null(state.RevenueLockReason);
        Assert.False(state.ShareLocked);
        Assert.Null(state.ShareLockReason);
        Assert.Equal(2, state.PerLegCostLocks.Count);
        Assert.All(state.PerLegCostLocks.Values, l => Assert.False(l.Locked));
    }

    [Fact]
    public async Task GetSplitPricingLockStateAsync_ArchivedParentInvoiced_LocksRevenueAndShare()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, UcjbInvoiceNo = 555 },
            new TucJobArchive { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId },
            new TucJobArchive { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var state = await repository.GetSplitPricingLockStateAsync(parentId);

        Assert.True(state.RevenueLocked);
        Assert.Equal("Invoiced", state.RevenueLockReason);
        Assert.True(state.ShareLocked);
        Assert.Equal("Invoiced", state.ShareLockReason);
        Assert.All(state.PerLegCostLocks.Values, l => Assert.False(l.Locked));
    }

    [Fact]
    public async Task GetSplitPricingLockStateAsync_OneLegSettled_LocksThatLegOnlyAndShare()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.CourierSettlementBatches.Add(new CourierSettlementBatch { Id = 1, Created = new DateTime(2026, 9, 12) });
        _context.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId },
            new TucJobArchive { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, CourierSettlementBatchId = 1 },
            new TucJobArchive { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var state = await repository.GetSplitPricingLockStateAsync(parentId);

        Assert.False(state.RevenueLocked);
        Assert.True(state.ShareLocked);
        Assert.NotNull(state.ShareLockReason);
        Assert.True(state.PerLegCostLocks[legA].Locked);
        Assert.Equal("Settled 12 Sep", state.PerLegCostLocks[legA].Reason);
        Assert.False(state.PerLegCostLocks[legB].Locked);
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_WorkedExample_ReturnsReconciledGridFigures()
    {
        const int parentId = 4071;
        const int legA = 40711;
        const int legB = 40712;

        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "KT4071V", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "KT4071VA", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 1, UcjbCourierId = 1 },
            new TucJob { UcjbId = legB, UcjbNumber = "KT4071VB", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 2 });
        _context.TucCouriers.Add(new TucCourier
        {
            UccrId = 1, Code = "DRV1", UccrName = "Sam", UccrSurname = "Driver",
            Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
        });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, parentId, null, "Base", 64.00m, 32.00m),
            CreatePricingBreakdown(2, parentId, null, "Base Fuel", 16.00m, 24.00m),
            CreatePricingBreakdown(3, parentId, null, "Items", 20.00m, 4.00m),
            CreatePricingBreakdown(4, parentId, null, "Items Fuel", 5.00m, 3.00m),
            CreatePricingBreakdown(5, parentId, null, "Congestion", 9.00m, 6.00m));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 80m, ChargeAmount = 51.20m, CostAmount = 25.60m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 20m, ChargeAmount = 12.80m, CostAmount = 6.40m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legA, SharePercent = 80m, ChargeAmount = 12.80m, CostAmount = 19.20m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 2, LegJobId = legB, SharePercent = 20m, ChargeAmount = 3.20m, CostAmount = 4.80m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 3, LegJobId = legA, SharePercent = 80m, ChargeAmount = 16.00m, CostAmount = 3.20m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 3, LegJobId = legB, SharePercent = 20m, ChargeAmount = 4.00m, CostAmount = 0.80m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 4, LegJobId = legA, SharePercent = 80m, ChargeAmount = 4.00m, CostAmount = 2.40m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 4, LegJobId = legB, SharePercent = 20m, ChargeAmount = 1.00m, CostAmount = 0.60m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 5, LegJobId = legA, SharePercent = 80m, ChargeAmount = 7.20m, CostAmount = 4.80m },
            new PricingBreakdownAllocation { ParentPricingBreakdownId = 5, LegJobId = legB, SharePercent = 20m, ChargeAmount = 1.80m, CostAmount = 1.20m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var dto = await repository.GetSplitPricingBreakdownAsync(parentId);

        Assert.NotNull(dto);
        Assert.Equal(114.00m, dto.TotalRevenue);
        Assert.Equal(69.00m, dto.TotalCost);
        Assert.Equal(45.00m, dto.GrossProfit);
        Assert.Equal(45.00m / 114.00m * 100m, dto.MarginPercent);
        Assert.Equal(5, dto.Items.Count);

        var legAResult = Assert.Single(dto.Legs, l => l.JobId == legA);
        Assert.Equal("KT4071VA", legAResult.JobNumber);
        Assert.Equal("Sam Driver", legAResult.DriverName);
        Assert.Equal(91.20m, legAResult.Revenue);
        Assert.Equal(55.20m, legAResult.Cost);
        Assert.False(legAResult.CostLocked);

        var baseItem = dto.Items.Single(i => i.Name == "Base");
        Assert.All(baseItem.Allocations, a => Assert.Equal(a.Cost, a.DerivedCost));

        var legBResult = Assert.Single(dto.Legs, l => l.JobId == legB);
        Assert.Equal("KT4071VB", legBResult.JobNumber);
        Assert.Null(legBResult.DriverName);
        Assert.Equal(22.80m, legBResult.Revenue);
        Assert.Equal(13.80m, legBResult.Cost);

        Assert.False(dto.Locks.RevenueLocked);
        Assert.False(dto.Locks.ShareLocked);
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_WithCostOverride_DerivedCostShowsWhatItReplaced()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m, costAmount: 40.00m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, CostOverride = 5.00m }]
        });

        var dto = await repository.GetSplitPricingBreakdownAsync(parentId);

        Assert.NotNull(dto);
        var item = Assert.Single(dto.Items);
        var legAAllocation = item.Allocations.Single(a => a.LegJobId == legA);
        var legBAllocation = item.Allocations.Single(a => a.LegJobId == legB);

        Assert.Equal(5.00m, legAAllocation.Cost);
        Assert.Equal(5.00m, legAAllocation.CostOverride);
        Assert.Equal(20.00m, legAAllocation.DerivedCost);

        Assert.Equal(20.00m, legBAllocation.Cost);
        Assert.Null(legBAllocation.CostOverride);
        Assert.Equal(20.00m, legBAllocation.DerivedCost);
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_NotASplitParent_ReturnsNull()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 1, UcjbNumber = "J1" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        Assert.Null(await repository.GetSplitPricingBreakdownAsync(1));
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_SplitParentPredatingThisFeature_SynthesizesEqualSplit()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 1 },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 2 });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", 100.00m, 40.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var dto = await repository.GetSplitPricingBreakdownAsync(parentId);

        Assert.NotNull(dto);
        Assert.Equal(2, dto.Legs.Count);
        var item = Assert.Single(dto.Items);
        Assert.Equal(2, item.Allocations.Count);
        Assert.All(item.Allocations, a => Assert.Equal(50m, a.SharePercent));
        Assert.Equal(100.00m, item.Allocations.Sum(a => a.Revenue));
        Assert.Equal(40.00m, item.Allocations.Sum(a => a.Cost));

        _context.ChangeTracker.Clear();
        Assert.Empty(await _context.PricingBreakdownAllocations.ToListAsync(TestContext.Current.CancellationToken));
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_SplitParentPredatingThisFeatureWithNoLiveLegs_ReturnsNull()
    {
        const int parentId = 100;
        const int legId = 101;
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legId, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, UcjbVoid = true });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        Assert.Null(await repository.GetSplitPricingBreakdownAsync(parentId));
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_ArchivedSplitParent_ReturnsLegsAwareBreakdown()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJobArchive { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 1, UcjbCourierId = 1 },
            new TucJobArchive { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 2 });
        _context.TucCouriers.Add(new TucCourier
        {
            UccrId = 1, Code = "DRV1", UccrName = "Sam", UccrSurname = "Driver",
            Created = TestDates.Now, CreatedBy = "T", LastModified = TestDates.Now, LastModifiedBy = "T"
        });
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(1, parentId, "Base", 100.00m, 40.00m));
        _context.PricingBreakdownAllocationArchives.AddRange(
            new PricingBreakdownAllocationArchive { ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = 80m, ChargeAmount = 80.00m, CostAmount = 32.00m },
            new PricingBreakdownAllocationArchive { ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = 20m, ChargeAmount = 20.00m, CostAmount = 8.00m });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var dto = await repository.GetSplitPricingBreakdownAsync(parentId, isArchived: true);

        Assert.NotNull(dto);
        Assert.Equal(100.00m, dto.TotalRevenue);
        Assert.Equal(40.00m, dto.TotalCost);

        var legAResult = Assert.Single(dto.Legs, l => l.JobId == legA);
        Assert.Equal("J100A", legAResult.JobNumber);
        Assert.Equal("Sam Driver", legAResult.DriverName);
        Assert.Equal(80.00m, legAResult.Revenue);

        var legBResult = Assert.Single(dto.Legs, l => l.JobId == legB);
        Assert.Equal("J100B", legBResult.JobNumber);
        Assert.Null(legBResult.DriverName);
        Assert.Equal(20.00m, legBResult.Revenue);
    }

    [Fact]
    public async Task GetSplitPricingBreakdownAsync_ArchivedSplitParentPredatingThisFeature_SynthesizesEqualSplit()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        _context.TucJobArchives.AddRange(
            new TucJobArchive { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJobArchive { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 1 },
            new TucJobArchive { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild, Sequence = 2 });
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(1, parentId, "Base", 100.00m, 40.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        var dto = await repository.GetSplitPricingBreakdownAsync(parentId, isArchived: true);

        Assert.NotNull(dto);
        Assert.Equal(2, dto.Legs.Count);
        var item = Assert.Single(dto.Items);
        Assert.Equal(2, item.Allocations.Count);
        Assert.All(item.Allocations, a => Assert.Equal(50m, a.SharePercent));
        Assert.Equal(100.00m, item.Allocations.Sum(a => a.Revenue));
        Assert.Equal(40.00m, item.Allocations.Sum(a => a.Cost));
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_RevenueEdit_ReDerivesBothLegsByShare()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 60m, shareB: 40m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            ItemRevenues = [new SplitPricingItemRevenueUpdate { PricingBreakdownId = 1, Revenue = 200.00m }]
        });

        _context.ChangeTracker.Clear();
        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        var legBJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legB, TestContext.Current.CancellationToken);
        Assert.Equal(120.00m, legAJob.UcjbAmount);
        Assert.Equal(80.00m, legBJob.UcjbAmount);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_NameEdit_RenamesItem()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 60m, shareB: 40m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            ItemRevenues = [new SplitPricingItemRevenueUpdate { PricingBreakdownId = 1, Revenue = 100.00m, Name = "Freight" }]
        });

        _context.ChangeTracker.Clear();
        var item = await _context.PricingBreakdowns.FirstAsync(p => p.PricingBreakdownId == 1, TestContext.Current.CancellationToken);
        Assert.Equal("Freight", item.ChargeName);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_RenameAcrossFuelBoundary_ThrowsAndDoesNotApplyAnyEdit()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 60m, shareB: 40m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentException>(() => repository.UpdateSplitPricingBreakdownAsync(
            new UpdateSplitPricingBreakdownRequest
            {
                JobId = parentId,
                ItemRevenues = [new SplitPricingItemRevenueUpdate { PricingBreakdownId = 1, Revenue = 200.00m, Name = "Base Fuel" }]
            }));

        _context.ChangeTracker.Clear();
        var item = await _context.PricingBreakdowns.FirstAsync(p => p.PricingBreakdownId == 1, TestContext.Current.CancellationToken);
        Assert.Equal("Base", item.ChargeName);
        Assert.Equal(100.00m, item.ChargeAmount);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_CostOverride_AppliesAndSurvivesLaterShareChange()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m, costAmount: 40.00m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, CostOverride = 5.00m }]
        });

        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations =
            [
                new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, SharePercent = 70m },
                new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legB, SharePercent = 30m }
            ]
        });

        _context.ChangeTracker.Clear();
        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        Assert.Equal(5.00m, legAJob.CourierPayment);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_ResetCostOverride_GoesBackToDerived()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m, costAmount: 40.00m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, CostOverride = 5.00m }]
        });

        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, ResetCostOverride = true }]
        });

        _context.ChangeTracker.Clear();
        var legAJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legA, TestContext.Current.CancellationToken);
        Assert.Equal(20.00m, legAJob.CourierPayment);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_RevenueLockedOnInvoicedParent_Throws()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m);
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = parentId, UcjbNumber = "ARCH100", ParentId = parentId, UcjbInvoiceNo = 1 });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateSplitPricingBreakdownAsync(
            new UpdateSplitPricingBreakdownRequest
            {
                JobId = parentId,
                ItemRevenues = [new SplitPricingItemRevenueUpdate { PricingBreakdownId = 1, Revenue = 200.00m }]
            }));
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_LegCostLocked_ThrowsForThatLegOnly()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m, costAmount: 40.00m);
        _context.CourierSettlementBatches.Add(new CourierSettlementBatch { Id = 1, Created = new DateTime(2026, 9, 12) });
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = legA, UcjbNumber = "ARCH101", ParentId = parentId, CourierSettlementBatchId = 1 });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateSplitPricingBreakdownAsync(
            new UpdateSplitPricingBreakdownRequest
            {
                JobId = parentId,
                Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, CostOverride = 5.00m }]
            }));

        await repository.UpdateSplitPricingBreakdownAsync(new UpdateSplitPricingBreakdownRequest
        {
            JobId = parentId,
            Allocations = [new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legB, CostOverride = 9.00m }]
        });

        _context.ChangeTracker.Clear();
        var legBJob = await _context.TucJobs.FirstAsync(j => j.UcjbId == legB, TestContext.Current.CancellationToken);
        Assert.Equal(9.00m, legBJob.CourierPayment);
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_ShareDoesNotSumTo100_ThrowsArgumentException()
    {
        const int parentId = 100;
        const int legA = 101;
        const int legB = 102;
        SeedTwoLegSplitParent(parentId, legA, legB, itemAmount: 100.00m, shareA: 50m, shareB: 50m);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentException>(() => repository.UpdateSplitPricingBreakdownAsync(
            new UpdateSplitPricingBreakdownRequest
            {
                JobId = parentId,
                Allocations =
                [
                    new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legA, SharePercent = 70m },
                    new SplitPricingAllocationUpdate { PricingBreakdownId = 1, LegJobId = legB, SharePercent = 40m }
                ]
            }));
    }

    [Fact]
    public async Task UpdateSplitPricingBreakdownAsync_NotASplitParent_Throws()
    {
        _context.TucJobs.Add(new TucJob { UcjbId = 1, UcjbNumber = "J1" });
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        await Assert.ThrowsAsync<InvalidOperationException>(() => repository.UpdateSplitPricingBreakdownAsync(
            new UpdateSplitPricingBreakdownRequest
            {
                JobId = 1,
                ItemRevenues = [new SplitPricingItemRevenueUpdate { PricingBreakdownId = 1, Revenue = 10m }]
            }));
    }

    private void SeedTwoLegSplitParent(
        int parentId, int legA, int legB, decimal itemAmount, decimal shareA, decimal shareB, decimal? costAmount = null)
    {
        _context.TucJobs.AddRange(
            new TucJob { UcjbId = parentId, UcjbNumber = "J100", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent },
            new TucJob { UcjbId = legA, UcjbNumber = "J100A", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild },
            new TucJob { UcjbId = legB, UcjbNumber = "J100B", ParentId = parentId, JobRelationshipTypeId = (int)JobRelationshipTypes.SplitChild });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, parentId, null, "Base", itemAmount, costAmount));
        _context.PricingBreakdownAllocations.AddRange(
            new PricingBreakdownAllocation
            {
                ParentPricingBreakdownId = 1, LegJobId = legA, SharePercent = shareA,
                ChargeAmount = itemAmount * shareA / 100m, CostAmount = costAmount * shareA / 100m
            },
            new PricingBreakdownAllocation
            {
                ParentPricingBreakdownId = 1, LegJobId = legB, SharePercent = shareB,
                ChargeAmount = itemAmount * shareB / 100m, CostAmount = costAmount * shareB / 100m
            });
    }

    private static TucJob CreateJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJobArchive CreateArchivedJob(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber
    };

    private static TucJobBooking CreatePrebookJob(int id, string jobNumber) => new()
    {
        UcbkId = id,
        UcbkJobNumber = jobNumber
    };

    private static PricingBreakdown CreatePricingBreakdown(int id, int? jobId, int? prebookJobId, string name, decimal amount, decimal? costAmount = null, int? childJobId = null) => new()
    {
        PricingBreakdownId = id,
        JobId = jobId,
        PrebookJobId = prebookJobId,
        ChargeName = name,
        ChargeAmount = amount,
        CostAmount = costAmount,
        ChildJobId = childJobId
    };

    /// <summary>A split parent — ParentId points at itself, so it resolves as its own effective job.</summary>
    private static TucJob CreateSplitParent(int id, string jobNumber) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = id,
        RootParentId = id
    };

    private static TucJob CreateSplitLeg(int id, string jobNumber, int parentId) => new()
    {
        UcjbId = id,
        UcjbNumber = jobNumber,
        ParentId = parentId,
        RootParentId = parentId
    };

    private static PricingBreakdownArchive CreatePricingBreakdownArchive(
        int id, int? jobId, string name, decimal amount, decimal? costAmount = null, int? childJobId = null) => new()
    {
        PricingBreakdownId = id,
        JobId = jobId,
        ChargeName = name,
        ChargeAmount = amount,
        CostAmount = costAmount,
        ChildJobId = childJobId
    };

}
