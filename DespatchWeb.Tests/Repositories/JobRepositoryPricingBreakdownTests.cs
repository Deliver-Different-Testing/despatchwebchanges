using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository pricing breakdown operations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class JobRepositoryPricingBreakdownTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryPricingBreakdownTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateMoqFactoryMock(_context);

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);

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
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
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

        // Act & Assert - Should not throw
        var act = async () => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
        var exception = await Record.ExceptionAsync(act);
        Assert.Null(exception);
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

        // Act & Assert - Should not throw
        var act = async () => await repository.UpdateJobPriceBreakdownAsync(viewModel, isArchived: false);
        var exception = await Record.ExceptionAsync(act);
        Assert.Null(exception);
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

        // Act & Assert - Should not throw
        var act = async () => await repository.DeleteJobPriceBreakdownAsync(999, isArchived: false);
        var exception = await Record.ExceptionAsync(act);
        Assert.Null(exception);
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

    private static PricingBreakdown CreatePricingBreakdown(int id, int? jobId, int? prebookJobId, string name, decimal amount, decimal? costAmount = null) => new()
    {
        PricingBreakdownId = id,
        JobId = jobId,
        PrebookJobId = prebookJobId,
        ChargeName = name,
        ChargeAmount = amount,
        CostAmount = costAmount
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
