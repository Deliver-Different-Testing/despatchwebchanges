using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository pricing breakdown operations.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class JobRepositoryPricingBreakdownTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    public JobRepositoryPricingBreakdownTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Register custom SQLite function to mimic SQL Server's getdate()
        _connection.CreateFunction("getdate", () => DateTime.Now);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        var options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        _context = new DespatchContext(options);
        _context.Database.EnsureCreated();
        _contextFactoryMock.Setup(f => f.CreateDbContext()).Returns(_context);

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);

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

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object
    );

    #region GetJobPriceBreakdownAsync Tests

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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(b => b.Name == "Base Charge" && b.Amount == 100.00m);
        result.Should().Contain(b => b.Name == "Fuel Surcharge" && b.Amount == 15.00m);
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: true);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(b => b.Name == "Base Charge" && b.Amount == 200.00m);
        result.Should().Contain(b => b.Name == "Fuel Surcharge" && b.Amount == 25.00m);
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(prebookId, isPrebook: true, isArchived: false);

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(b => b.Name == "Prebook Base" && b.Amount == 150.00m);
        result.Should().Contain(b => b.PrebookJobId == prebookId);
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithNoBreakdowns_ReturnsEmptyList()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId, isPrebook: false, isArchived: false);

        // Assert
        result.Should().BeEmpty();
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(jobId1, isPrebook: false, isArchived: false);

        // Assert
        result.Should().ContainSingle();
        result.First().Name.Should().Be("Job 1 Charge");
    }

    [Fact]
    public async Task GetJobPriceBreakdownAsync_WithNonExistentArchivedJob_ReturnsEmptyList()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetJobPriceBreakdownAsync(999, isPrebook: false, isArchived: true);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region AddJobPriceBreakdownAsync Tests

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithLiveJob_AddsToLiveTable()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        await _context.SaveChangesAsync();

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
        chargeId.Should().BeGreaterThan(0);
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().NotBeNull();
        breakdown.ChargeName.Should().Be("New Charge");
        breakdown.ChargeAmount.Should().Be(50.00m);
        breakdown.JobId.Should().Be(jobId);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithArchivedJob_AddsToArchiveTable()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        await _context.SaveChangesAsync();

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
        chargeId.Should().BeGreaterThan(0);
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().NotBeNull();
        breakdown.ChargeName.Should().Be("Archive Charge");
        breakdown.ChargeAmount.Should().Be(75.00m);
        breakdown.JobId.Should().Be(jobId);
    }

    [Fact]
    public async Task AddJobPriceBreakdownAsync_WithPrebookJob_AddsToPrebookBreakdowns()
    {
        // Arrange
        const int prebookId = 100;
        _context.TucJobBookings.Add(CreatePrebookJob(prebookId, "PREBOOK001"));
        await _context.SaveChangesAsync();

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
        chargeId.Should().BeGreaterThan(0);
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().NotBeNull();
        breakdown.ChargeName.Should().Be("Prebook Charge");
        breakdown.PrebookJobId.Should().Be(prebookId);
        breakdown.JobId.Should().BeNull();
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
        chargeId.Should().Be(0);
    }

    #endregion

    #region UpdateJobPriceBreakdownAsync Tests

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithLiveJob_UpdatesBreakdown()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(chargeId, jobId, null, "Original", 100.00m));
        await _context.SaveChangesAsync();

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
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().NotBeNull();
        breakdown.ChargeName.Should().Be("Updated");
        breakdown.ChargeAmount.Should().Be(150.00m);
        breakdown.CostAmount.Should().Be(50.00m);
    }

    [Fact]
    public async Task UpdateJobPriceBreakdownAsync_WithArchivedJob_UpdatesArchiveBreakdown()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(chargeId, jobId, "Original", 100.00m));
        await _context.SaveChangesAsync();

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
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().NotBeNull();
        breakdown.ChargeName.Should().Be("Updated Archive");
        breakdown.ChargeAmount.Should().Be(175.00m);
        breakdown.CostAmount.Should().Be(60.00m);
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
        await act.Should().NotThrowAsync();
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
        await act.Should().NotThrowAsync();
    }

    #endregion

    #region DeleteJobPriceBreakdownAsync Tests

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithLiveBreakdown_DeletesFromLiveTable()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobs.Add(CreateJob(jobId, "JOB001"));
        _context.PricingBreakdowns.Add(CreatePricingBreakdown(chargeId, jobId, null, "To Delete", 100.00m));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: false);

        // Assert
        var breakdown = await _context.PricingBreakdowns.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().BeNull();
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithArchivedBreakdown_DeletesFromArchiveTable()
    {
        // Arrange
        const int jobId = 100;
        const int chargeId = 1;
        _context.TucJobArchives.Add(CreateArchivedJob(jobId, "ARCH001"));
        _context.PricingBreakdownArchives.Add(CreatePricingBreakdownArchive(chargeId, jobId, "Archive To Delete", 100.00m));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(chargeId, isArchived: true);

        // Assert
        var breakdown = await _context.PricingBreakdownArchives.FirstOrDefaultAsync(p => p.PricingBreakdownId == chargeId);
        breakdown.Should().BeNull();
    }

    [Fact]
    public async Task DeleteJobPriceBreakdownAsync_WithNonExistentChargeId_DoesNotThrow()
    {
        // Arrange
        var repository = CreateRepository();

        // Act & Assert - Should not throw
        var act = async () => await repository.DeleteJobPriceBreakdownAsync(999, isArchived: false);
        await act.Should().NotThrowAsync();
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
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.DeleteJobPriceBreakdownAsync(2, isArchived: false);

        // Assert
        var remaining = await _context.PricingBreakdowns.ToListAsync();
        remaining.Should().ContainSingle();
        remaining.First().ChargeName.Should().Be("Keep");
    }

    #endregion

    #region Helper Methods

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

    #endregion
}
