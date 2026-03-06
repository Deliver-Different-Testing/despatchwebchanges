using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the BookedTime edit path in JobRepository.EditOperations.
/// Verifies that editing a job's booked date/time updates both UcjbDate and UcjbTime
/// for live jobs (via ExecuteUpdateAsync) and archived jobs (via entity tracking).
/// </summary>
public class JobRepositoryEditBookedTimeTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();

    public JobRepositoryEditBookedTimeTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _connection.CreateFunction("getdate", () => DateTime.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        _contextFactoryMock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime()).Returns(DateTime.Now);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private DespatchContext CreateContext() => new(_contextOptions);

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    #region Live Job BookedTime Tests

    [Fact]
    public async Task UpdateJobAsync_BookedTime_LiveJob_UpdatesBothUcjbDateAndUcjbTime()
    {
        // Arrange
        var originalDate = new DateTime(2024, 3, 4, 6, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync();
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(1, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 1);

        updatedJob.UcjbDate.Should().Be(newDateTime.DateTime,
            "UcjbDate should be updated to the new booked date/time");
        updatedJob.UcjbTime.Should().Be(newDateTime.DateTime,
            "UcjbTime should also be updated to match the new booked date/time");
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_LiveJob_OverwritesPreviousTime()
    {
        // Arrange — simulates the original bug: date on 4th, time at 6am
        var originalDate = new DateTime(2024, 3, 4, 0, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync();
        }

        // User edits to 3rd March at 15:20
        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert — the old 6am time must NOT survive
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 2);

        updatedJob.UcjbTime.Should().NotBe(originalTime,
            "the old UcjbTime (6am) should be overwritten, not preserved");
        updatedJob.UcjbTime!.Value.Hour.Should().Be(15);
        updatedJob.UcjbTime!.Value.Minute.Should().Be(20);
    }

    #endregion

    #region Archived Job BookedTime Tests

    [Fact]
    public async Task UpdateJobAsync_BookedTime_ArchivedJob_UpdatesBothUcjbDateAndUcjbTime()
    {
        // Arrange
        var originalDate = new DateTime(2024, 3, 4, 6, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync();
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 3);

        updatedArchive.UcjbDate.Should().Be(newDateTime.DateTime,
            "archived UcjbDate should be updated to the new booked date/time");
        updatedArchive.UcjbTime.Should().Be(newDateTime.DateTime,
            "archived UcjbTime should also be updated to match the new booked date/time");
    }

    [Fact]
    public async Task UpdateJobAsync_BookedTime_ArchivedJob_OverwritesPreviousTime()
    {
        // Arrange — same bug scenario but for archived jobs
        var originalDate = new DateTime(2024, 3, 4, 0, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 4,
                UcjbNumber = "JOB-004",
                UcjbDate = originalDate,
                UcjbTime = originalTime
            });
            await context.SaveChangesAsync();
        }

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(4, JobProperty.BookedTime, newDateTime.ToString("O"));

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 4);

        updatedArchive.UcjbTime.Should().NotBe(originalTime,
            "the old archived UcjbTime (6am) should be overwritten");
        updatedArchive.UcjbTime!.Value.Hour.Should().Be(15);
        updatedArchive.UcjbTime!.Value.Minute.Should().Be(20);
    }

    #endregion
}
