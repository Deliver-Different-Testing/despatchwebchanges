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
/// Tests for RecurringJobRepository - focuses on UpdateRecurringJobAsync method.
/// Uses SQLite in-memory database to properly test ExecuteUpdateAsync bulk operations.
/// </summary>
public class RecurringJobRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    public RecurringJobRepositoryTests()
    {
        // Create and open a SQLite connection that will be kept alive for the test
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Disable foreign key constraints for testing
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
    }

    public void Dispose()
    {
        _context.Dispose();
        _connection.Dispose();
    }

    private RecurringJobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object
    );

    #region UpdateRecurringJobAsync - ClientID Tests

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_FetchesCorrectClientCode()
    {
        // Arrange
        const int jobId = 100;
        const int newClientId = 42;
        const string expectedClientCode = "TESTCLIENT";

        // Add clients - AGRAT is first alphabetically, but we want TESTCLIENT
        _context.TucClients.AddRange(
            CreateClient(1, "AGRAT"),
            CreateClient(42, expectedClientCode),
            CreateClient(99, "ZZZCLIENT")
        );

        _context.TucJobBookings.Add(CreateJobBooking(jobId, 1, "AGRAT"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Verify the correct client code was set (not AGRAT which is first)
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkClientId.Should().Be(newClientId);
        updatedJob.UcbkClientCode.Should().Be(expectedClientCode);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_DoesNotUseFirstClientInDatabase()
    {
        // Arrange - This test specifically verifies the bug fix
        // Before the fix, FirstOrDefaultAsync() without Where() would return "AGRAT"
        const int jobId = 100;
        const int newClientId = 55;
        const string expectedClientCode = "NEWCLIENT";

        // AGRAT comes first alphabetically and has lowest ID
        _context.TucClients.AddRange(
            CreateClient(1, "AGRAT"),
            CreateClient(55, expectedClientCode)
        );

        _context.TucJobBookings.Add(CreateJobBooking(jobId, 1, "AGRAT"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Should be NEWCLIENT, NOT AGRAT
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkClientCode.Should().Be(expectedClientCode);
        updatedJob.UcbkClientCode.Should().NotBe("AGRAT");
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_WithNonExistentClient_SetsNullCode()
    {
        // Arrange
        const int jobId = 100;
        const int nonExistentClientId = 9999;

        _context.TucClients.AddRange(
            CreateClient(1, "AGRAT"),
            CreateClient(2, "OTHER")
        );

        _context.TucJobBookings.Add(CreateJobBooking(jobId, 1, "AGRAT"));
        await _context.SaveChangesAsync();

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, nonExistentClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Client code should be null for non-existent client
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkClientId.Should().Be(nonExistentClientId);
        updatedJob.UcbkClientCode.Should().BeNull();
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_UpdatesRelatedJobBookings()
    {
        // Arrange
        const int parentJobId = 100;
        const int childJobId = 101;
        const int newClientId = 42;
        const string expectedClientCode = "NEWCLIENT";

        _context.TucClients.Add(CreateClient(42, expectedClientCode));

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentJobId, 1, "OLD"),
            CreateJobBooking(childJobId, 1, "OLD", bookingParentId: parentJobId)
        );

        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentJobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Both parent and child should be updated
        var parentJob = await _context.TucJobBookings.FindAsync(parentJobId);
        var childJob = await _context.TucJobBookings.FindAsync(childJobId);

        parentJob!.UcbkClientId.Should().Be(newClientId);
        parentJob.UcbkClientCode.Should().Be(expectedClientCode);
        childJob!.UcbkClientId.Should().Be(newClientId);
        childJob.UcbkClientCode.Should().Be(expectedClientCode);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_UpdatesJobsWithParentId()
    {
        // Arrange
        const int parentJobId = 100;
        const int childJobId = 101;
        const int newClientId = 42;
        const string expectedClientCode = "NEWCLIENT";

        _context.TucClients.Add(CreateClient(42, expectedClientCode));

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentJobId, 1, "OLD"),
            CreateJobBooking(childJobId, 1, "OLD", parentId: parentJobId)
        );

        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentJobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Both parent and child (via ParentId) should be updated
        var parentJob = await _context.TucJobBookings.FindAsync(parentJobId);
        var childJob = await _context.TucJobBookings.FindAsync(childJobId);

        parentJob!.UcbkClientCode.Should().Be(expectedClientCode);
        childJob!.UcbkClientCode.Should().Be(expectedClientCode);
    }

    #endregion

    #region UpdateRecurringJobAsync - Other Properties Tests

    [Fact]
    public async Task UpdateRecurringJobAsync_Items_UpdatesQuantity()
    {
        // Arrange
        const int jobId = 100;
        const short newQuantity = 5;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, quantity: 1));
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Items, newQuantity.ToString());

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.Quantity.Should().Be(newQuantity);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_SpeedID_UpdatesSpeed()
    {
        // Arrange
        const int jobId = 100;
        const int newSpeedId = 3;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, speed: 1, done: false));
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SpeedID, newSpeedId.ToString());

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkSpeed.Should().Be(newSpeedId);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_SpeedID_DoesNotUpdateDoneJobs()
    {
        // Arrange
        const int jobId = 100;
        const int originalSpeed = 1;
        const int newSpeedId = 3;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, speed: originalSpeed, done: true));
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SpeedID, newSpeedId.ToString());

        _context.ChangeTracker.Clear();

        // Assert - Speed should remain unchanged for done jobs
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkSpeed.Should().Be(originalSpeed);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Pedal_UpdatesCbdFlag()
    {
        // Arrange
        const int jobId = 100;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, cbd: false));
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Pedal, "true");

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkCbd.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Attention_UpdatesAttentionFlag()
    {
        // Arrange
        const int jobId = 100;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, attention: false));
        await _context.SaveChangesAsync();
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Attention, "true");

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync(jobId);
        updatedJob!.UcbkAttention.Should().BeTrue();
    }

    #endregion

    #region Helper Methods

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

    private static TucJobBooking CreateJobBooking(
        int id,
        int? clientId = null,
        string? clientCode = null,
        int? bookingParentId = null,
        int? parentId = null,
        short? quantity = null,
        int? speed = null,
        bool? done = null,
        bool? cbd = null,
        bool? attention = null) => new()
    {
        UcbkId = id,
        UcbkClientId = clientId,
        UcbkClientCode = clientCode,
        BookingParentId = bookingParentId,
        ParentId = parentId,
        Quantity = quantity,
        UcbkSpeed = speed,
        UcbkDone = done,
        UcbkCbd = cbd,
        UcbkAttention = attention ?? false,
        UcbkJobNumber = $"JOB{id}"
    };

    #endregion
}
