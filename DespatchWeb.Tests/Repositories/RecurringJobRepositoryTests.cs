using System.Globalization;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
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
public class RecurringJobRepositoryTests : IAsyncDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DespatchContext _context;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public RecurringJobRepositoryTests()
    {
        // Create and open a SQLite connection that will be kept alive for the test
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _connection.CreateFunction("getdate", () => TestDates.Now);

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

    public async ValueTask DisposeAsync()
    {
        await _context.DisposeAsync();
        await _connection.DisposeAsync();
    }

    private RecurringJobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Verify the correct client code was set (not AGRAT which is first)
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Should be NEWCLIENT, NOT AGRAT
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.ClientID, nonExistentClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Client code should be null for non-existent client
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentJobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Both parent and child should be updated
        if (_context.TucJobBookings != null)
        {
            var parentJob = await _context.TucJobBookings.FindAsync([parentJobId], TestContext.Current.CancellationToken);
            var childJob = await _context.TucJobBookings.FindAsync([childJobId], TestContext.Current.CancellationToken);

            parentJob!.UcbkClientId.Should().Be(newClientId);
            parentJob.UcbkClientCode.Should().Be(expectedClientCode);
            childJob!.UcbkClientId.Should().Be(newClientId);
            childJob.UcbkClientCode.Should().Be(expectedClientCode);
        }
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

        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentJobId, JobProperty.ClientID, newClientId.ToString());

        // Clear tracking to get fresh data
        _context.ChangeTracker.Clear();

        // Assert - Both parent and child (via ParentId) should be updated
        var parentJob = await _context.TucJobBookings.FindAsync([parentJobId], TestContext.Current.CancellationToken);
        var childJob = await _context.TucJobBookings.FindAsync([childJobId], TestContext.Current.CancellationToken);

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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Items, newQuantity.ToString());

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.Quantity.Should().Be(newQuantity);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_SpeedID_UpdatesSpeed()
    {
        // Arrange
        const int jobId = 100;
        const int newSpeedId = 3;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, speed: 1, done: false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SpeedID, newSpeedId.ToString());

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
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
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SpeedID, newSpeedId.ToString());

        _context.ChangeTracker.Clear();

        // Assert - Speed should remain unchanged for done jobs
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkSpeed.Should().Be(originalSpeed);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Pedal_UpdatesCbdFlag()
    {
        // Arrange
        const int jobId = 100;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, cbd: false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Pedal, "true");

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkCbd.Should().BeTrue();
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Attention_UpdatesAttentionFlag()
    {
        // Arrange
        const int jobId = 100;

        _context.TucJobBookings.Add(CreateJobBooking(jobId, attention: false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Attention, "true");

        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkAttention.Should().BeTrue();
    }

    #endregion

    #region GetRecurringJobsListAsync - Timezone Conversion Tests

    [Fact]
    public async Task GetRecurringJobsListAsync_WithValidDates_AppliesTimezoneConversion()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: 100,
            date: validDate,
            time: validTime,
            nextDue: validDate.AddDays(7),
            active: true,
            oneOff: false
        ));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(1);
        var item = result.Items.First();

        // The booked date should have timezone offset applied (NZ is +12 or +13)
        item.Booked.Offset.Should().NotBe(TimeSpan.Zero);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithNullDates_DoesNotApplyTimezoneConversion()
    {
        // Arrange - Job with null date/time will use SqlMinDateTime (1753-01-01) as fallback
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: 100,
            date: null,
            time: null,
            nextDue: null,
            active: true,
            oneOff: false
        ));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act - Should NOT throw exception for null dates
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(1);
        var item = result.Items.First();

        // Booked should be the fallback SqlMinDateTime (1753-01-01), not converted
        item.Booked.Year.Should().Be(1753);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithMinValueDates_DoesNotThrowException()
    {
        // Arrange - This tests the fix for the DateTimeOffset conversion error
        // DateTime.MinValue (0001-01-01) would cause "UTC time must be between year 0 and 10,000"
        // when converted to DateTimeOffset with positive timezone offset (like NZ +12/+13)
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        // Add job with dates that would result in SqlMinDateTime fallback
        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: 100,
            date: null,
            time: null,
            nextDue: null,
            active: true,
            oneOff: false
        ));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act & Assert - Should not throw ArgumentOutOfRangeException
        var act = async () => await repository.GetRecurringJobsListAsync(request);
        await act.Should().NotThrowAsync<ArgumentOutOfRangeException>();
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithValidNextDueTime_AppliesTimezoneConversion()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        var nextDue = new DateTime(2024, 6, 22, 9, 0, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: 100,
            date: validDate,
            time: validTime,
            nextDue: nextDue,
            active: true,
            oneOff: false
        ));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(1);
        var item = result.Items.First();

        // NextDueTime should have timezone offset applied
        item.NextDueTime.Should().NotBeNull();
        item.NextDueTime!.Value.Offset.Should().NotBe(TimeSpan.Zero);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithNullNextDueTime_HandlesGracefully()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: 100,
            date: validDate,
            time: validTime,
            nextDue: null, // Null NextDueTime
            active: true,
            oneOff: false
        ));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(1);
        var item = result.Items.First();
        item.NextDueTime.Should().BeNull();
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_EmptyResult_ReturnsEmptyList()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        // No jobs added
        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().BeEmpty();
        result.Total.Should().Be(0);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_MixedValidAndNullDates_HandlesAllCorrectly()
    {
        // Arrange - Mix of jobs with valid dates and null dates
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, validDate, validTime, validDate.AddDays(7), true, false),
            CreateJobBookingWithDates(101, null, null, null, true, false),
            CreateJobBookingWithDates(102, validDate, validTime, null, true, false)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act - Should not throw for mixed dates
        var act = async () => await repository.GetRecurringJobsListAsync(request);
        await act.Should().NotThrowAsync();

        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(3);
    }

    #endregion

    #region GetRecurringJobByIdAsync Tests

    [Fact]
    public async Task GetRecurringJobByIdAsync_WithValidJob_ReturnsJobGroup()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBookingWithDetails(jobId, "JOB100", clientCode: "TEST"));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRecurringJobByIdAsync(jobId);

        // Assert
        result.Should().NotBeNull();
        result.Job.Should().NotBeNull();
        result.Job.Id.Should().Be(jobId);
    }

    [Fact]
    public async Task GetRecurringJobByIdAsync_WithParentAndChildren_ReturnsAllRelatedJobs()
    {
        // Arrange
        const int parentId = 100;
        const int childId1 = 101;
        const int childId2 = 102;

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDetails(parentId, "PARENT"),
            CreateJobBookingWithDetails(childId1, "CHILD1", bookingParentId: parentId),
            CreateJobBookingWithDetails(childId2, "CHILD2", bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRecurringJobByIdAsync(parentId);

        // Assert
        result.Job.Id.Should().Be(parentId);
        result.RelatedJobs.Should().HaveCount(2);
        result.RelatedJobs.Select(j => j.Id).Should().Contain([childId1, childId2]);
    }

    [Fact]
    public async Task GetRecurringJobByIdAsync_RequestingChildJob_ReturnsChildAsMainJob()
    {
        // Arrange
        const int parentId = 100;
        const int childId = 101;

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDetails(parentId, "PARENT"),
            CreateJobBookingWithDetails(childId, "CHILD", bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRecurringJobByIdAsync(childId);

        // Assert
        result.Job.Id.Should().Be(childId);
        result.RelatedJobs.Should().ContainSingle(j => j.Id == parentId);
    }

    [Fact]
    public async Task GetRecurringJobByIdAsync_WithNonExistentJob_ThrowsArgumentNullException()
    {
        // Arrange
        var repository = CreateRepository();

        // Act & Assert
        var act = async () => await repository.GetRecurringJobByIdAsync(999);
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    #endregion

    #region UpdateRecurringJobAsync - Additional Property Tests

    [Theory]
    [InlineData("true")]
    [InlineData("false")]
    public async Task UpdateRecurringJobAsync_Reprice_UpdatesRepriceFlag(string value)
    {
        // Arrange
        const int jobId = 100;
        var expected = bool.Parse(value);
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Reprice, value);
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.Reprice.Should().Be(expected);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Truck_SetsTruckAndClearsVan()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBookingWithVehicle(jobId, van: true, truck: false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Truck, "true");
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.Truck.Should().BeTrue();
        updatedJob.UcbkVan.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Van_SetsVanAndClearsTruck()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBookingWithVehicle(jobId, van: false, truck: true));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Van, "true");
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkVan.Should().BeTrue();
        updatedJob.Truck.Should().BeFalse();
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_RefA_TruncatesTo20Characters()
    {
        // Arrange
        const int jobId = 100;
        var longValue = new string('A', 50);
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.RefA, longValue);
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkClientRefa.Should().HaveLength(20);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_RefB_TruncatesTo15Characters()
    {
        // Arrange
        const int jobId = 100;
        var longValue = new string('B', 50);
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.RefB, longValue);
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkClientRefb.Should().HaveLength(15);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Amount_UpdatesDecimalValue()
    {
        // Arrange
        const int jobId = 100;
        const decimal newAmount = 123.45m;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Amount, newAmount.ToString(CultureInfo.InvariantCulture));
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.UcbkAmount.Should().Be(newAmount);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_CourierId_UpdatesCourier()
    {
        // Arrange
        const int jobId = 100;
        const int newCourierId = 42;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.CourierId, newCourierId.ToString());
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.CourierId.Should().Be(newCourierId);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Time_UpdatesParentAndChildren()
    {
        // Arrange
        const int parentId = 100;
        const int childId = 101;
        var newTime = new DateTime(2024, 1, 15, 14, 30, 0);

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(childId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentId, JobProperty.Time, newTime.ToString("O"));
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var child = await _context.TucJobBookings.FindAsync([childId], TestContext.Current.CancellationToken);
        parent!.UcbkTime.Should().Be(newTime);
        child!.UcbkTime.Should().Be(newTime);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Weight_UpdatesParentAndChildren()
    {
        // Arrange
        const int parentId = 100;
        const int childId = 101;
        const short newWeight = 25;

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(childId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentId, JobProperty.Weight, newWeight.ToString());
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var child = await _context.TucJobBookings.FindAsync([childId], TestContext.Current.CancellationToken);
        parent!.UcbkWeight.Should().Be(newWeight);
        child!.UcbkWeight.Should().Be(newWeight);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_Direct_UpdatesDirectFlag()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.Direct, "true");
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.Direct.Should().BeTrue();
    }

    // Note: Active property tests are skipped because they trigger note creation,
    // which requires SQL Server's getdate() function that SQLite doesn't support.

    [Fact]
    public async Task UpdateRecurringJobAsync_FromContactName_UpdatesParentAndFirstChild()
    {
        // Arrange
        const int parentId = 100;
        const int firstChildId = 101;
        const int secondChildId = 102;
        const string newContact = "John Smith";

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(firstChildId, bookingParentId: parentId),
            CreateJobBooking(secondChildId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentId, JobProperty.FromContactName, newContact);
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var firstChild = await _context.TucJobBookings.FindAsync([firstChildId], TestContext.Current.CancellationToken);
        var secondChild = await _context.TucJobBookings.FindAsync([secondChildId], TestContext.Current.CancellationToken);

        parent!.PickupFromContact.Should().Be(newContact);
        firstChild!.PickupFromContact.Should().Be(newContact);
        secondChild!.PickupFromContact.Should().BeNull(); // Second child should NOT be updated
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ToContactName_UpdatesParentAndLastChild()
    {
        // Arrange
        const int parentId = 100;
        const int firstChildId = 101;
        const int secondChildId = 102;
        const string newContact = "Jane Doe";

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(firstChildId, bookingParentId: parentId),
            CreateJobBooking(secondChildId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(parentId, JobProperty.ToContactName, newContact);
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var firstChild = await _context.TucJobBookings.FindAsync([firstChildId], TestContext.Current.CancellationToken);
        var secondChild = await _context.TucJobBookings.FindAsync([secondChildId], TestContext.Current.CancellationToken);

        parent!.DeliverToContact.Should().Be(newContact);
        firstChild!.DeliverToContact.Should().BeNull(); // First child should NOT be updated
        secondChild!.DeliverToContact.Should().Be(newContact);
    }

    #endregion

    #region UpdateBookingDeliveryAddressAsync Tests

    [Fact]
    public async Task UpdateBookingDeliveryAddressAsync_WithValidJob_UpdatesAddress()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new UpdateAddressRequest
        {
            JobId = jobId,
            Address = CreateTestAddress("123 Delivery St", "Auckland", "1010")
        };

        // Act
        await repository.UpdateBookingDeliveryAddressAsync(request);
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.DeliveryAddressLine1.Should().Be("123 Delivery St");
        updatedJob.DeliveryAddressLine6.Should().Be("Auckland");
        updatedJob.DeliveryAddressLine7.Should().Be("1010");
    }

    [Fact]
    public async Task UpdateBookingDeliveryAddressAsync_WithParentAndChildren_UpdatesParentAndLastChild()
    {
        // Arrange
        const int parentId = 100;
        const int firstChildId = 101;
        const int lastChildId = 102;

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(firstChildId, bookingParentId: parentId),
            CreateJobBooking(lastChildId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new UpdateAddressRequest
        {
            JobId = parentId,
            Address = CreateTestAddress("456 New Delivery", "Wellington", "6011")
        };

        // Act
        await repository.UpdateBookingDeliveryAddressAsync(request);
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var firstChild = await _context.TucJobBookings.FindAsync([firstChildId], TestContext.Current.CancellationToken);
        var lastChild = await _context.TucJobBookings.FindAsync([lastChildId], TestContext.Current.CancellationToken);

        parent!.DeliveryAddressLine1.Should().Be("456 New Delivery");
        firstChild!.DeliveryAddressLine1.Should().BeNull(); // First child NOT updated
        lastChild!.DeliveryAddressLine1.Should().Be("456 New Delivery");
    }

    [Fact]
    public async Task UpdateBookingDeliveryAddressAsync_WithNonExistentJob_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var request = new UpdateAddressRequest
        {
            JobId = 999,
            Address = CreateTestAddress("Test", "Test", "1234")
        };

        // Act & Assert
        var act = async () => await repository.UpdateBookingDeliveryAddressAsync(request);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*999*not found*");
    }

    #endregion

    #region UpdateBookingPickupAddressAsync Tests

    [Fact]
    public async Task UpdateBookingPickupAddressAsync_WithValidJob_UpdatesAddress()
    {
        // Arrange
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new UpdateAddressRequest
        {
            JobId = jobId,
            Address = CreateTestAddress("789 Pickup Ave", "Hamilton", "3200")
        };

        // Act
        await repository.UpdateBookingPickupAddressAsync(request);
        _context.ChangeTracker.Clear();

        // Assert
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        updatedJob!.PickupAddressLine1.Should().Be("789 Pickup Ave");
        updatedJob.PickupAddressLine6.Should().Be("Hamilton");
        updatedJob.PickupAddressLine7.Should().Be("3200");
    }

    [Fact]
    public async Task UpdateBookingPickupAddressAsync_WithParentAndChildren_UpdatesParentAndFirstChild()
    {
        // Arrange
        const int parentId = 100;
        const int firstChildId = 101;
        const int lastChildId = 102;

        _context.TucJobBookings.AddRange(
            CreateJobBooking(parentId),
            CreateJobBooking(firstChildId, bookingParentId: parentId),
            CreateJobBooking(lastChildId, bookingParentId: parentId)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new UpdateAddressRequest
        {
            JobId = parentId,
            Address = CreateTestAddress("111 New Pickup", "Christchurch", "8011")
        };

        // Act
        await repository.UpdateBookingPickupAddressAsync(request);
        _context.ChangeTracker.Clear();

        // Assert
        var parent = await _context.TucJobBookings.FindAsync([parentId], TestContext.Current.CancellationToken);
        var firstChild = await _context.TucJobBookings.FindAsync([firstChildId], TestContext.Current.CancellationToken);
        var lastChild = await _context.TucJobBookings.FindAsync([lastChildId], TestContext.Current.CancellationToken);

        parent!.PickupAddressLine1.Should().Be("111 New Pickup");
        firstChild!.PickupAddressLine1.Should().Be("111 New Pickup");
        lastChild!.PickupAddressLine1.Should().BeNull(); // Last child NOT updated
    }

    [Fact]
    public async Task UpdateBookingPickupAddressAsync_WithNonExistentJob_ThrowsArgumentException()
    {
        // Arrange
        var repository = CreateRepository();
        var request = new UpdateAddressRequest
        {
            JobId = 999,
            Address = CreateTestAddress("Test", "Test", "1234")
        };

        // Act & Assert
        var act = async () => await repository.UpdateBookingPickupAddressAsync(request);
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*999*not found*");
    }

    #endregion

    #region GetAllRecurringJobsForExportAsync Tests

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_ReturnsAllActiveJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, TestDates.Now, null, null, true, false),
            CreateJobBookingWithDates(101, TestDates.Now, null, null, true, false),
            CreateJobBookingWithDates(102, TestDates.Now, null, null, false, false) // Inactive
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithSpeedFilter_FiltersCorrectly()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithSpeed(100, 1, true),
            CreateJobBookingWithSpeed(101, 2, true),
            CreateJobBookingWithSpeed(102, 1, true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, SpeedId = 1 };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.Id == 100 || j.Id == 102);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithCourierFilter_FiltersCorrectly()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithCourier(100, 10, true),
            CreateJobBookingWithCourier(101, 20, true),
            CreateJobBookingWithCourier(102, 10, true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, CourierId = 10 };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithSearchText_SearchesAllAddressFields()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithAddress(100, "123 Queen St", true),
            CreateJobBookingWithAddress(101, "456 King Ave", true),
            CreateJobBookingWithAddress(102, "789 Queen Road", true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, SearchText = "Queen" };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().HaveCount(2);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_ExcludesOneOffJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, TestDates.Now, null, null, true, false), // Recurring
            CreateJobBookingWithDates(101, TestDates.Now, null, null, true, true)   // One-off
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().ContainSingle();
        result[0].Id.Should().Be(100);
    }

    [Theory]
    [InlineData("booked", false)]
    [InlineData("booked", true)]
    [InlineData("speed", false)]
    [InlineData("courier", false)]
    public async Task GetAllRecurringJobsForExportAsync_WithSortOptions_SortsCorrectly(string order, bool descending)
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, new DateTime(2024, 1, 1), null, null, true, false),
            CreateJobBookingWithDates(101, new DateTime(2024, 6, 1), null, null, true, false),
            CreateJobBookingWithDates(102, new DateTime(2024, 3, 1), null, null, true, false)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest
        {
            Active = true,
            Order = order,
            OrderDirection = descending ? "desc" : "asc"
        };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        result.Should().HaveCount(3);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByClientCode_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithSearchFields(100, clientCode: "ACME01", active: true),
            CreateJobBookingWithSearchFields(101, clientCode: "GLOBEX", active: true),
            CreateJobBookingWithSearchFields(102, clientCode: "ACME02", active: true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50, SearchText = "ACME" };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Id).Should().Contain([100, 102]);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByContactName_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithSearchFields(100, pickupContact: "John Smith", active: true),
            CreateJobBookingWithSearchFields(101, deliverContact: "Jane Smith", active: true),
            CreateJobBookingWithSearchFields(102, pickupContact: "Bob Jones", active: true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50, SearchText = "Smith" };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Id).Should().Contain([100, 101]);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByClientReference_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithSearchFields(100, clientRefA: "PO-12345", active: true),
            CreateJobBookingWithSearchFields(101, clientRefB: "INV-12345", active: true),
            CreateJobBookingWithSearchFields(102, ourRef: "REF-99999", active: true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50, SearchText = "12345" };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Id).Should().Contain([100, 101]);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByConnote_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithSearchFields(100, connote: "CN-ABC-001", active: true),
            CreateJobBookingWithSearchFields(101, connote: "CN-XYZ-002", active: true),
            CreateJobBookingWithSearchFields(102, connote: "CN-ABC-003", active: true)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50, SearchText = "ABC" };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(2);
        result.Items.Select(i => i.Id).Should().Contain([100, 102]);
    }

    #endregion

    #region GetRecurringNotesByJobIdAsync Tests

    [Fact]
    public async Task GetRecurringNotesByJobIdAsync_ReturnsNotesSortedByCreatedDateDescending()
    {
        // Arrange
        const int jobBookingId = 100;
        var oldestDate = new DateTime(2024, 1, 1, 10, 0, 0);
        var middleDate = new DateTime(2024, 6, 15, 14, 30, 0);
        var newestDate = new DateTime(2024, 12, 31, 23, 59, 0);

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");

        _context.TucNoteTypes.Add(CreateNoteType(1, "Internal Note"));
        _context.TucJobBookings.Add(CreateJobBooking(jobBookingId));
        _context.TucNotes.AddRange(
            CreateNote(1, jobBookingId, "Middle note", middleDate),
            CreateNote(2, jobBookingId, "Oldest note", oldestDate),
            CreateNote(3, jobBookingId, "Newest note", newestDate)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetRecurringNotesByJobIdAsync(jobBookingId);

        // Assert
        result.Should().HaveCount(3);
        result[0].NoteText.Should().Be("Newest note");
        result[1].NoteText.Should().Be("Middle note");
        result[2].NoteText.Should().Be("Oldest note");
    }

    #endregion

    #region GetRecurringJobsListAsync - Filtering Tests

    [Fact]
    public async Task GetRecurringJobsListAsync_WithDaysOfWeekFilter_FiltersByBitwiseMatch()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);

        // Monday = 1, Tuesday = 2, Wednesday = 4
        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDays(100, 1, true),   // Monday only
            CreateJobBookingWithDays(101, 3, true),   // Monday + Tuesday
            CreateJobBookingWithDays(102, 4, true)    // Wednesday only
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        // Filter for Monday (1)
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50, DaysOfWeek = 1 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        result.Items.Should().HaveCount(2); // Jobs 100 and 101 have Monday
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_ForUsTenant_ExcludesChildJobs()
    {
        // Arrange
        const string timezone = "Pacific Standard Time";
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns(timezone);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(true);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, TestDates.Now, null, null, true, false),
            CreateJobBookingWithDetails(101, "CHILD", bookingParentId: 100)
        );
        // Set the child as active
        var child = await _context.TucJobBookings.FindAsync([101], TestContext.Current.CancellationToken);
        child!.UcbkActive = true;
        child.UcbkOneOff = false;
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert - US tenant should only see parent jobs
        result.Items.Should().ContainSingle();
        result.Items.First().Id.Should().Be(100);
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

    private static TucJobBooking CreateJobBookingWithDates(
        int id,
        DateTime? date,
        DateTime? time,
        DateTime? nextDue,
        bool active,
        bool oneOff) => new()
    {
        UcbkId = id,
        UcbkDate = date,
        UcbkTime = time,
        UcbkNextDue = nextDue,
        UcbkActive = active,
        UcbkOneOff = oneOff,
        UcbkJobNumber = $"JOB{id}",
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithDetails(
        int id,
        string jobNumber,
        string? clientCode = null,
        int? bookingParentId = null) => new()
    {
        UcbkId = id,
        UcbkJobNumber = jobNumber,
        UcbkClientCode = clientCode,
        BookingParentId = bookingParentId,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithVehicle(
        int id,
        bool van,
        bool truck) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        UcbkVan = van,
        Truck = truck,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithSpeed(
        int id,
        int speed,
        bool active) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        UcbkSpeed = speed,
        UcbkActive = active,
        UcbkOneOff = false,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithCourier(
        int id,
        int courierId,
        bool active) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        CourierId = courierId,
        UcbkActive = active,
        UcbkOneOff = false,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithAddress(
        int id,
        string addressLine1,
        bool active) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        DeliveryAddressLine1 = addressLine1,
        UcbkActive = active,
        UcbkOneOff = false,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithDays(
        int id,
        int daysInt,
        bool active) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        UcbkDaysInt = daysInt,
        UcbkActive = active,
        UcbkOneOff = false,
        UcbkAttention = false
    };

    private static TucJobBooking CreateJobBookingWithSearchFields(
        int id,
        bool active,
        string? clientCode = null,
        string? pickupContact = null,
        string? deliverContact = null,
        string? clientRefA = null,
        string? clientRefB = null,
        string? ourRef = null,
        string? connote = null) => new()
    {
        UcbkId = id,
        UcbkJobNumber = $"JOB{id}",
        UcbkActive = active,
        UcbkOneOff = false,
        UcbkAttention = false,
        UcbkClientCode = clientCode,
        PickupFromContact = pickupContact,
        DeliverToContact = deliverContact,
        UcbkClientRefa = clientRefA,
        UcbkClientRefb = clientRefB,
        UcbkOurRef = ourRef,
        Connote = connote
    };

    private static AddressViewModel CreateTestAddress(
        string line1,
        string suburb,
        string postcode) => new()
    {
        AddressLine1 = line1,
        AddressLine6 = suburb,
        AddressLine7 = postcode
    };

    private static TucNoteType CreateNoteType(int id, string name) => new()
    {
        NoteTypeId = id,
        NoteTypeName = name,
        IsActive = true,
        IsPublic = false,
        IsSystemDefined = true
    };

    private static TucNote CreateNote(int noteId, int jobBookingId, string noteText, DateTime createdDate) => new()
    {
        NoteId = noteId,
        JobBookingId = jobBookingId,
        NoteText = noteText,
        NoteTypeId = 1,
        IsImportant = false,
        CreatedDate = createdDate,
        UpdatedDate = createdDate // Explicit to avoid SQLite getdate() issue
    };

    #endregion
}
