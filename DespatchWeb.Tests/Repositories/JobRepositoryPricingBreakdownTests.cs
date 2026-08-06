using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
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

        // Default tenant setup
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);

        // Add required note type for note creation
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
        Substitute.For<ICourierRepository>()
    );

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithLiveJob_ReturnsBreakdowns()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Base Charge", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Fuel Surcharge", 15.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Base Charge" && b.Amount == 100.00m);
        Assert.Contains(result, b => b.Name == "Fuel Surcharge" && b.Amount == 15.00m);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithArchivedJob_ReturnsArchiveBreakdowns()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.AddRange(
            CreatePricingBreakdownArchive(1, jobId, "Base Charge", 200.00m),
            CreatePricingBreakdownArchive(2, jobId, "Fuel Surcharge", 25.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: true);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Base Charge" && b.Amount == 200.00m);
        Assert.Contains(result, b => b.Name == "Fuel Surcharge" && b.Amount == 25.00m);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithPrebookJob_ReturnsPrebookBreakdowns()
    {
        // Arrange
        const int prebookId = 100;
        _context.TucJobBookings.Add(CreatePrebookJob(prebookId, "PREBOOK001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, null, prebookId, "Prebook Base", 150.00m),
            CreatePricingBreakdown(2, null, prebookId, "Prebook Surcharge", 20.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(prebookId, isPrebook: true, isArchived: false);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, b => b.Name == "Prebook Base" && b.Amount == 150.00m);
        Assert.Contains(result, b => b.PrebookJobId == prebookId);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithNoBreakdowns_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_OnlyReturnsBreakdownsForSpecificJob()
    {
        // Arrange
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

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId1, isPrebook: false, isArchived: false);

        // Assert
        Assert.Single(result);
        Assert.Equal("Job 1 Charge", result[0].Name);
    }

    // ── Split legs (KT1314V) ───────────────────────────────────────────────────────────────────
    //
    // A leg's lines are stored on the parent with ChildJobId pointing at the leg. Returning the
    // parent's whole breakdown to a leg made both parts of KT1314V report the parent's full
    // US$89.00 / US$50.00 while their own headers each read US$44.50.

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

        // The parent stays the invoice-level view: every row, summing to the untouched total.
        Assert.Equal(4, parentResult.Count);
        Assert.Equal(73.00m, parentResult.Sum(r => r.Amount));
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_ForLegacySplitLeg_StillFallsBackToTheParentsLines()
    {
        // Jobs split before per-leg lines existed have no attributed rows at all. Those keep the
        // original fallback rather than rendering an empty breakdown.
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
    public async Task GetJobPriceBreakdownAsync_ForSplitLegWithNoLinesOfItsOwn_ReturnsEmpty()
    {
        // Once any leg carries attributed rows, a leg with none of its own genuinely has no pricing
        // — it must not borrow its sibling's or the parent's.
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
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(999, isPrebook: false, isArchived: true);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithLiveJob_AddsToLiveTable()
    {
        // Arrange
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

        // Act
        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
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
        // Arrange
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

        // Act
        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: true);

        // Assert
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
        // Arrange
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

        // Act
        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
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
        // Arrange
        var viewModel = new ChargeViewModel
        {
            Name = "Invalid Charge",
            Amount = 50.00m
        };

        var repository = CreateRepository();

        // Act
        var chargeId = await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
        Assert.Equal(0, chargeId);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithLiveJob_UpdatesBreakdown()
    {
        // Arrange
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

        // Act
        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert - Clear change tracker to ensure we read fresh data from DB
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
        // Arrange
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

        // Act
        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: true);

        // Assert - Clear change tracker to ensure we read fresh data from DB
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
        // Arrange
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

        // Act & Assert - Should not throw
        async Task Act() => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithNonExistentChargeId_DoesNothing()
    {
        // Arrange
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

        // Act & Assert - Should not throw
        async Task Act() => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLiveBreakdown_DeletesFromLiveTable()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(chargeId, jobId, null, "To Delete", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: false);

        // Assert
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(breakdown);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithArchivedBreakdown_DeletesFromArchiveTable()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(chargeId, jobId, "Archive To Delete", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: true);

        // Assert
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId, cancellationToken: TestContext.Current.CancellationToken);
        Assert.Null(breakdown);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithNonExistentChargeId_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        var exception = await Record.ExceptionAsync(Act);
        Assert.Null(exception);
        return;

        // Act & Assert - Should not throw
        async Task Act() => await repository.DeleteJobPriceBreakdownAsync(999, isArchived: false);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_OnlyDeletesSpecificBreakdown()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Keep", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Delete", 200.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        // Assert
        var remaining = await _context.PricingBreakdowns.ToListAsync(cancellationToken: TestContext.Current.CancellationToken);
        Assert.Single(remaining);
        Assert.Equal("Keep", remaining.First().ChargeName);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithLiveJob_SyncsUcjbAmountToBreakdownSum()
    {
        // Arrange
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

        // Act
        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(125.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithArchivedJob_SyncsUcjbAmountToBreakdownSum()
    {
        // Arrange
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

        // Act
        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: true);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(125.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithPrebookJob_SyncsUcbkAmountToBreakdownSum()
    {
        // Arrange
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

        // Act
        await repository.AddJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
        _context.ChangeTracker.Clear();
        var booking = await _context.TucJobBookings.FirstAsync(j => j.UcbkId == prebookId, TestContext.Current.CancellationToken);
        Assert.Equal(120.00m, booking.UcbkAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithLiveJob_SyncsUcjbAmountToNewSum()
    {
        // Arrange
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

        // Act
        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(250.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithArchivedJob_SyncsUcjbAmountToNewSum()
    {
        // Arrange
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

        // Act
        await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: true);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(175.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLiveBreakdown_SyncsUcjbAmountToRemainingSum()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 150.00m });
        _context.PricingBreakdowns.AddRange(
            CreatePricingBreakdown(1, jobId, null, "Keep", 100.00m),
            CreatePricingBreakdown(2, jobId, null, "Remove", 50.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(100.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithArchivedBreakdown_SyncsUcjbAmountToRemainingSum()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobArchives.Add(new TucJobArchive { UcjbId = jobId, UcjbNumber = "ARCH001", UcjbAmount = 200.00m });
        _context.PricingBreakdownArchives.AddRange(
            CreatePricingBreakdownArchive(1, jobId, "Keep", 120.00m),
            CreatePricingBreakdownArchive(2, jobId, "Remove", 80.00m)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: true);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(120.00m, job.UcjbAmount);
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLastLiveBreakdown_ZeroesUcjbAmount()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = "JOB001", UcjbAmount = 100.00m });
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(1, jobId, null, "Only line", 100.00m));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(1, isArchived: false);

        // Assert
        _context.ChangeTracker.Clear();
        var job = await _context.TucJobs.FirstAsync(j => j.UcjbId == jobId, TestContext.Current.CancellationToken);
        Assert.Equal(0m, job.UcjbAmount);
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

    private static PricingBreakdownArchive CreatePricingBreakdownArchive(int id, int? jobId, string name, decimal amount, decimal? costAmount = null) => new()
    {
        PricingBreakdownId = id,
        JobId = jobId,
        ChargeName = name,
        ChargeAmount = amount,
        CostAmount = costAmount
    };

}
