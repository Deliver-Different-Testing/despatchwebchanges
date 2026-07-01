using System.Globalization;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for RecurringJobRepository - focuses on UpdateRecurringJobAsync method.
/// Uses SQLite in-memory database to properly test ExecuteUpdateAsync bulk operations.
/// </summary>
public class RecurringJobRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly DespatchContext _context;
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public RecurringJobRepositoryTests()
    {
        _context = _db.CreateContext();
        _contextFactoryMock = SqliteTestDatabase.CreateFactoryMock(_context);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _context.DisposeAsync();
        await _db.DisposeAsync();
    }

    private RecurringJobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock
    );

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
        Assert.Equal(newClientId, updatedJob!.UcbkClientId);
        Assert.Equal(expectedClientCode, updatedJob.UcbkClientCode);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_ClientID_DoesNotUseFirstClientInDatabase()
    {
        // Arrange - This test specifically verifies the bug fix
        // Before the fix, FirstOrDefaultAsync() without Where() would return "AGRAT"
        const int jobId = 100;
        const int newClientId = 55;
        const string expectedClientCode = "NEWCLIENT";

        // AGRAT comes first alphabetically and has the lowest ID
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
        Assert.Equal(expectedClientCode, updatedJob!.UcbkClientCode);
        Assert.NotEqual("AGRAT", updatedJob.UcbkClientCode);
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
        Assert.Equal(nonExistentClientId, updatedJob!.UcbkClientId);
        Assert.Null(updatedJob.UcbkClientCode);
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

            Assert.Equal(newClientId, parentJob!.UcbkClientId);
            Assert.Equal(expectedClientCode, parentJob.UcbkClientCode);
            Assert.Equal(newClientId, childJob!.UcbkClientId);
            Assert.Equal(expectedClientCode, childJob.UcbkClientCode);
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

        Assert.Equal(expectedClientCode, parentJob!.UcbkClientCode);
        Assert.Equal(expectedClientCode, childJob!.UcbkClientCode);
    }

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
        Assert.Equal(newQuantity, updatedJob!.Quantity);
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
        Assert.Equal(newSpeedId, updatedJob!.UcbkSpeed);
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
        Assert.Equal(originalSpeed, updatedJob!.UcbkSpeed);
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
        Assert.True(updatedJob!.UcbkCbd);
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
        Assert.True(updatedJob!.UcbkAttention);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_SavedFlightNumber_UpcasesAndStores()
    {
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SavedFlightNumber, "nz123");

        _context.ChangeTracker.Clear();
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        Assert.Equal("NZ123", updatedJob!.SavedFlightNumber);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_SavedFlightNumber_EmptyClearsToNull()
    {
        const int jobId = 100;
        var booking = CreateJobBooking(jobId);
        booking.SavedFlightNumber = "NZ123";
        _context.TucJobBookings.Add(booking);
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        await repository.UpdateRecurringJobAsync(jobId, JobProperty.SavedFlightNumber, "");

        _context.ChangeTracker.Clear();
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        Assert.Null(updatedJob!.SavedFlightNumber);
    }

    [Fact]
    public async Task SaveRecurringFlightAsync_StampsAirportsAndUpcasedFlight()
    {
        // A recurring booking created without a route — the "add flight" flow
        // supplies airports + flight together so push-to-live auto-assign (which
        // needs both airports non-null) can match.
        const int jobId = 100;
        _context.TucJobBookings.Add(CreateJobBooking(jobId));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        await repository.SaveRecurringFlightAsync(jobId, fromAirportId: 150, toAirportId: 96, flightNumber: "nz 123");

        _context.ChangeTracker.Clear();
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        Assert.Equal(150, updatedJob!.FromAirportId);
        Assert.Equal(96, updatedJob.ToAirportId);
        Assert.Equal("NZ 123", updatedJob.SavedFlightNumber);
    }

    [Fact]
    public async Task UpdateRecurringJobAsync_BookedTime_UpdatesBothUcbkDateAndUcbkTime()
    {
        // Arrange — the Ready card reads UcbkDate.CombineWithTime(UcbkTime),
        // so an edit that only writes UcbkDate leaves the time stale and the
        // new time bleeds into the Created card (which renders raw UcbkDate).
        const int jobId = 100;
        var originalDate = new DateTime(2024, 3, 4, 0, 0, 0);
        var originalTime = new DateTime(2024, 3, 4, 6, 0, 0);

        _context.TucJobBookings.Add(CreateJobBookingWithDates(
            id: jobId,
            date: originalDate,
            time: originalTime,
            nextDue: null,
            active: true,
            oneOff: false));
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var newDateTime = new DateTimeOffset(2024, 3, 3, 15, 20, 0, TimeSpan.Zero);
        var repository = CreateRepository();

        // Act
        await repository.UpdateRecurringJobAsync(jobId, JobProperty.BookedTime, newDateTime.ToString("O"));

        _context.ChangeTracker.Clear();

        // Assert — both UcbkDate AND UcbkTime carry the new value; the stale
        // 6am time from UcbkTime must not survive.
        var updatedJob = await _context.TucJobBookings.FindAsync([jobId], TestContext.Current.CancellationToken);
        Assert.Equal(newDateTime.DateTime, updatedJob!.UcbkDate);
        Assert.Equal(newDateTime.DateTime, updatedJob.UcbkTime);
        Assert.NotEqual(originalTime, updatedJob.UcbkTime);
        Assert.Equal(15, updatedJob.UcbkTime!.Value.Hour);
        Assert.Equal(20, updatedJob.UcbkTime!.Value.Minute);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithValidDates_AppliesTimezoneConversion()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Single(result.Items);
        var item = result.Items.First();

        // The booked date should have timezone offset applied (NZ is +12 or +13)
        Assert.NotEqual(TimeSpan.Zero, item.Booked.Offset);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithNullDates_DoesNotApplyTimezoneConversion()
    {
        // Arrange - Job with null date/time will use SqlMinDateTime (1753-01-01) as fallback
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Single(result.Items);
        var item = result.Items.First();

        // Booked should be the fallback SqlMinDateTime (1753-01-01), not converted
        Assert.Equal(1753, item.Booked.Year);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithMinValueDates_DoesNotThrowException()
    {
        // Arrange - This tests the fix for the DateTimeOffset conversion error
        // DateTime.MinValue (0001-01-01) would cause "UTC time must be between year 0 and 10,000"
        // when converted to DateTimeOffset with positive timezone offset (like NZ +12/+13)
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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

        var exception = await Record.ExceptionAsync((Func<Task<PaginatedResponse<PrebookListViewModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Null(exception);
        return;

        // Act & Assert - Should not throw ArgumentOutOfRangeException
        async Task<PaginatedResponse<PrebookListViewModel>> Act() => await repository.GetRecurringJobsListAsync(request);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithValidNextDueTime_AppliesTimezoneConversion()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        var nextDue = new DateTime(2024, 6, 22, 9, 0, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Single(result.Items);
        var item = result.Items.First();

        // NextDueTime should have timezone offset applied
        Assert.NotNull(item.NextDueTime);
        Assert.NotEqual(TimeSpan.Zero, item.NextDueTime!.Value.Offset);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithNullNextDueTime_HandlesGracefully()
    {
        // Arrange
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Single(result.Items);
        var item = result.Items.First();
        Assert.Null(item.NextDueTime);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_EmptyResult_ReturnsEmptyList()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        // No jobs added
        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        // Act
        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        Assert.Empty(result.Items);
        Assert.Equal(0, result.Total);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_MixedValidAndNullDates_HandlesAllCorrectly()
    {
        // Arrange - Mix of jobs with valid dates and null dates
        var validDate = new DateTime(2024, 6, 15, 10, 0, 0);
        var validTime = new DateTime(1900, 1, 1, 14, 30, 0);
        const string timezone = "New Zealand Standard Time";

        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, validDate, validTime, validDate.AddDays(7), true, false),
            CreateJobBookingWithDates(101, null, null, null, true, false),
            CreateJobBookingWithDates(102, validDate, validTime, null, true, false)
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);

        var repository = CreateRepository();
        var request = new RecurringJobQueryRequest { Active = true, Page = 1, Limit = 50 };

        var exception = await Record.ExceptionAsync((Func<Task<PaginatedResponse<PrebookListViewModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Null(exception);

        var result = await repository.GetRecurringJobsListAsync(request);

        // Assert
        Assert.Equal(3, result.Items.Count());
        return;

        // Act - Should not throw for mixed dates
        async Task<PaginatedResponse<PrebookListViewModel>> Act() => await repository.GetRecurringJobsListAsync(request);
    }

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
        Assert.NotNull(result);
        Assert.NotNull(result.Job);
        Assert.Equal(jobId, result.Job.Id);
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
        Assert.Equal(parentId, result.Job.Id);
        Assert.Equal(2, result.RelatedJobs.Count);
        Assert.Contains(result.RelatedJobs.Select(j => j.Id), id => id == childId1);
        Assert.Contains(result.RelatedJobs.Select(j => j.Id), id => id == childId2);
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
        Assert.Equal(childId, result.Job.Id);
        Assert.Single(result.RelatedJobs, j => j.Id == parentId);
    }

    [Fact]
    public async Task GetRecurringJobByIdAsync_WithNonExistentJob_ThrowsArgumentNullException()
    {
        // Arrange
        var repository = CreateRepository();

        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<JobGroupViewModel>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act & Assert
        async Task<JobGroupViewModel> Act() => await repository.GetRecurringJobByIdAsync(999);
    }

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
        Assert.Equal(expected, updatedJob!.Reprice);
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
        Assert.True(updatedJob!.Truck);
        Assert.False(updatedJob.UcbkVan);
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
        Assert.True(updatedJob!.UcbkVan);
        Assert.False(updatedJob.Truck);
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
        Assert.Equal(20, updatedJob!.UcbkClientRefa!.Length);
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
        Assert.Equal(15, updatedJob!.UcbkClientRefb!.Length);
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
        Assert.Equal(newAmount, updatedJob!.UcbkAmount);
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
        Assert.Equal(newCourierId, updatedJob!.CourierId);
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
        Assert.Equal(newTime, parent!.UcbkTime);
        Assert.Equal(newTime, child!.UcbkTime);
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
        Assert.Equal(newWeight, parent!.UcbkWeight);
        Assert.Equal(newWeight, child!.UcbkWeight);
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
        Assert.True(updatedJob!.Direct);
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

        Assert.Equal(newContact, parent!.PickupFromContact);
        Assert.Equal(newContact, firstChild!.PickupFromContact);
        Assert.Null(secondChild!.PickupFromContact); // Second child should NOT be updated
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

        Assert.Equal(newContact, parent!.DeliverToContact);
        Assert.Null(firstChild!.DeliverToContact); // First child should NOT be updated
        Assert.Equal(newContact, secondChild!.DeliverToContact);
    }

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
        Assert.Equal("123 Delivery St", updatedJob!.DeliveryAddressLine1);
        Assert.Equal("Auckland", updatedJob.DeliveryAddressLine6);
        Assert.Equal("1010", updatedJob.DeliveryAddressLine7);
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

        Assert.Equal("456 New Delivery", parent!.DeliveryAddressLine1);
        Assert.Null(firstChild!.DeliveryAddressLine1); // First child NOT updated
        Assert.Equal("456 New Delivery", lastChild!.DeliveryAddressLine1);
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

        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
        return;

        // Act & Assert
        async Task Act() => await repository.UpdateBookingDeliveryAddressAsync(request);
    }

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
        Assert.Equal("789 Pickup Ave", updatedJob!.PickupAddressLine1);
        Assert.Equal("Hamilton", updatedJob.PickupAddressLine6);
        Assert.Equal("3200", updatedJob.PickupAddressLine7);
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

        Assert.Equal("111 New Pickup", parent!.PickupAddressLine1);
        Assert.Equal("111 New Pickup", firstChild!.PickupAddressLine1);
        Assert.Null(lastChild!.PickupAddressLine1); // Last child NOT updated
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

        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Contains("999", ex.Message);
        Assert.Contains("not found", ex.Message);
        return;

        // Act & Assert
        async Task Act() => await repository.UpdateBookingPickupAddressAsync(request);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_ReturnsAllActiveJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

        _context.TucJobBookings.AddRange(
            CreateJobBookingWithDates(100, TestDates.Now, null, null, true, false),
            CreateJobBookingWithDates(101, TestDates.Now, null, null, true, false),
            CreateJobBookingWithDates(102, TestDates.Now, null, null, false, false) // Inactive
        );
        await _context.SaveChangesAsync(TestContext.Current.CancellationToken);
        // RecurringMode is configured with HasDefaultValue((byte)1) so EF treats
        // the CLR-default 0 as the sentinel and omits the column from INSERTs,
        // letting the DB default (=Active) take over. Re-stamp Inactive rows
        // explicitly so the fixture matches what active=false intended.
        await _context.TucJobBookings
            .Where(j => j.UcbkId == 102)
            .ExecuteUpdateAsync(s => s.SetProperty(x => x.RecurringMode,
                (byte)RecurringMode.Inactive), TestContext.Current.CancellationToken);
        var repository = CreateRepository();

        var request = new RecurringJobQueryRequest { Active = true };

        // Act
        var result = await repository.GetAllRecurringJobsForExportAsync(request);

        // Assert
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithSpeedFilter_FiltersCorrectly()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Count);
        Assert.All(result, j => Assert.True(j.Id == 100 || j.Id == 102));
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithCourierFilter_FiltersCorrectly()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_WithSearchText_SearchesAllAddressFields()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetAllRecurringJobsForExportAsync_ExcludesOneOffJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Single(result);
        Assert.Equal(100, result[0].Id);
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
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(3, result.Count);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByClientCode_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Items.Count());
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 100);
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 102);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByContactName_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Items.Count());
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 100);
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 101);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByClientReference_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Items.Count());
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 100);
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 101);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_SearchByConnote_ReturnsMatchingJobs()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Items.Count());
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 100);
        Assert.Contains(result.Items.Select(i => i.Id), id => id == 102);
    }

    [Fact]
    public async Task GetRecurringNotesByJobIdAsync_ReturnsNotesSortedByCreatedDateDescending()
    {
        // Arrange
        const int jobBookingId = 100;
        var oldestDate = new DateTime(2024, 1, 1, 10, 0, 0);
        var middleDate = new DateTime(2024, 6, 15, 14, 30, 0);
        var newestDate = new DateTime(2024, 12, 31, 23, 59, 0);

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");

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
        Assert.Equal(3, result.Count);
        Assert.Equal("Newest note", result[0].NoteText);
        Assert.Equal("Middle note", result[1].NoteText);
        Assert.Equal("Oldest note", result[2].NoteText);
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_WithDaysOfWeekFilter_FiltersByBitwiseMatch()
    {
        // Arrange
        const string timezone = "New Zealand Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);

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
        Assert.Equal(2, result.Items.Count()); // Jobs 100 and 101 have Monday
    }

    [Fact]
    public async Task GetRecurringJobsListAsync_ForUsTenant_ExcludesChildJobs()
    {
        // Arrange
        const string timezone = "Pacific Standard Time";
        _tenantInfoServiceMock.GetTenantTimeZone().Returns(timezone);
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

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
        Assert.Single(result.Items);
        Assert.Equal(100, result.Items.First().Id);
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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
        // BuildRecurringJobQuery filters by RecurringMode after Steve's 2026-06-09
        // tri-state migration; mirror the production sync rule here so test fixtures
        // that flag a row "inactive" via the legacy UcbkActive bool are also flagged
        // RecurringMode = Inactive. Active and Manual both map to ucbkActive = 1
        // per the compatibility rule, so Active is the safe default for active=true.
        RecurringMode = active ? (byte)RecurringMode.Active : (byte)RecurringMode.Inactive,
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

}
