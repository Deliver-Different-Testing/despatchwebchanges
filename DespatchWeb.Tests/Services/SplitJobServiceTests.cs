using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for SplitJobService - tests job splitting functionality.
/// </summary>
public class SplitJobServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _dbOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    private const int ParentRelationshipTypeId = 1;
    private const int ChildRelationshipTypeId = 2;
    private const int DefaultSpeedId = 100;
    private const int ParentJobCourierId = 999;
    private const int StaffId = 1;

    public SplitJobServiceTests()
    {
        // Use SQLite in-memory database (supports ExecuteUpdateAsync unlike InMemory provider)
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Register SQL Server functions that SQLite doesn't have
        _connection.CreateFunction("getdate", () => DateTime.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _dbOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        // Ensure database is created
        using (var context = new DespatchContext(_dbOptions))
        {
            context.Database.EnsureCreated();
        }

        // Setup mock for async context factory - create new context each time to avoid disposal issues
        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_dbOptions));
        _contextFactoryMock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_dbOptions));

        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(StaffId);

        // Setup required reference data
        SetupReferenceData();
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private DespatchContext CreateContext() => new(_dbOptions);

    private void SetupReferenceData()
    {
        using var context = CreateContext();

        // Add relationship types
        context.TblJobRelationshipTypes.AddRange(
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = ParentRelationshipTypeId,
                Name = "Split Parent",
                SystemName = "SplitParent",
                Created = DateTime.UtcNow,
                CreatedBy = "System",
                LastModified = DateTime.UtcNow,
                LastModifiedBy = "System"
            },
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = ChildRelationshipTypeId,
                Name = "Split Child",
                SystemName = "SplitChild",
                Created = DateTime.UtcNow,
                CreatedBy = "System",
                LastModified = DateTime.UtcNow,
                LastModifiedBy = "System"
            }
        );

        // Add job type (speed)
        context.TucJobTypes.Add(new TucJobType
        {
            UcjtId = DefaultSpeedId,
            UcjtName = "Same Day",
            UcjtCode = "SD",
            Created = DateTime.UtcNow,
            CreatedBy = "System",
            LastModified = DateTime.UtcNow,
            LastModifiedBy = "System"
        });

        // Note: Skipping TblSettings setup - the service handles null gracefully
        // The ParentJobCourierId will be null which is acceptable for testing

        // Add note type
        context.TucNoteTypes.Add(new TucNoteType
        {
            NoteTypeId = (int)NoteType.InternalNote,
            NoteTypeName = "Internal Note",
            IsActive = true
        });

        context.SaveChanges();
    }

    private SplitJobService CreateService() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object
    );

    private static TucJob CreateTestJob(int jobId, string jobNumber, int? parentId = null)
    {
        return new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = jobNumber,
            UcjbDate = DateTime.Today,
            UcjbTime = DateTime.Now,
            UcjbSpeed = DefaultSpeedId,
            UcjbFrom = 1,
            UcjbFromAddr = "123 Pickup St",
            UcjbTo = 2,
            UcjbToAddr = "456 Delivery Ave",
            UcjbStatus = 1,
            UcjbClientId = 1,
            ParentId = parentId,
            UcjbNotes = "Original job notes"
        };
    }

    private static TucJobBooking CreateTestJobBooking(int bookingId, string jobNumber, int? parentId = null)
    {
        return new TucJobBooking
        {
            UcbkId = bookingId,
            UcbkJobNumber = jobNumber,
            UcbkDate = DateTime.Today,
            UcbkTime = DateTime.Now,
            UcbkSpeed = DefaultSpeedId,
            UcbkFrom = 1,
            UcbkFromAddr = "123 Pickup St",
            UcbkTo = 2,
            UcbkToAddr = "456 Delivery Ave",
            UcbkClientId = 1,
            ParentId = parentId,
            UcbkNotes = "Original booking notes"
        };
    }

    private const int TestMeetingPointSuburbId = 50;

    private static AddressViewModel CreateTestMeetingPointAddress() => new(
        addressLine1: "Unit 5",
        addressLine2: "Meeting Point Building",
        addressLine3: "123",
        addressLine4: "Handoff Street",
        addressLine5: "Auckland",
        addressLine6: "Auckland Central",
        addressLine7: "1010",
        addressLine8: "Near main entrance"
    )
    {
        Latitude = -36.8485m,
        Longitude = 174.7633m
    };

    #region SplitJobAsync Success Tests

    [Fact]
    public async Task SplitJobAsync_ValidJob_CreatesPickupAndDeliveryJobs()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        pickupJobId.Should().BeGreaterThan(0);
        deliveryJobId.Should().BeGreaterThan(0);
        pickupJobId.Should().NotBe(deliveryJobId);

        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob.Should().NotBeNull();
            deliveryJob.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_SetsCorrectJobNumbers()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob!.UcjbNumber.Should().Be("JOB-001-1");
            deliveryJob!.UcjbNumber.Should().Be("JOB-001-2");
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_SetsParentChildRelationships()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Parent job should have parent relationship type
            parentJob!.JobRelationshipTypeId.Should().Be(ParentRelationshipTypeId);
            parentJob.ParentId.Should().Be(1);
            parentJob.RootParentId.Should().Be(1);

            // Child jobs should have child relationship type and point to parent
            pickupJob!.JobRelationshipTypeId.Should().Be(ChildRelationshipTypeId);
            pickupJob.ParentId.Should().Be(1);
            pickupJob.RootParentId.Should().Be(1);
            pickupJob.Sequence.Should().Be(1);

            deliveryJob!.JobRelationshipTypeId.Should().Be(ChildRelationshipTypeId);
            deliveryJob.ParentId.Should().Be(1);
            deliveryJob.RootParentId.Should().Be(1);
            deliveryJob.Sequence.Should().Be(2);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_UpdatesParentJobCourierId()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 123; // Original courier
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert - ParentJobCourierId is null since we don't seed TblSettings
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.UcjbCourierId.Should().BeNull();
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_PickupJobKeepsOriginalCourier()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 123;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            pickupJob!.UcjbCourierId.Should().Be(123);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_DeliveryJobHasNoCourier()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 123;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob!.UcjbCourierId.Should().BeNull();
        }
    }

    #endregion

    #region SplitJobAsync Note Creation Tests

    [Fact]
    public async Task SplitJobAsync_ValidJob_CreatesNotesInTucNotesTable()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == pickupJobId);
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == deliveryJobId);

            pickupNote.Should().NotBeNull();
            pickupNote.NoteText.Should().Contain("SPLIT Part 1 of 2");
            pickupNote.NoteTypeId.Should().Be((int)NoteType.InternalNote);
            pickupNote.CreatedBy.Should().Be(StaffId);

            deliveryNote.Should().NotBeNull();
            deliveryNote.NoteText.Should().Contain("SPLIT Part 2 of 2");
            deliveryNote.NoteTypeId.Should().Be((int)NoteType.InternalNote);
            deliveryNote.CreatedBy.Should().Be(StaffId);
        }
    }

    [Fact]
    public async Task SplitJobAsync_JobWithNotes_IncludesOriginalNotesInSplitNotes()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbNotes = "Important delivery instructions";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == pickupJobId);
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == deliveryJobId);

            pickupNote!.NoteText.Should().Contain("Important delivery instructions");
            deliveryNote!.NoteText.Should().Contain("Important delivery instructions");
        }
    }

    [Fact]
    public async Task SplitJobAsync_JobWithNoNotes_CreatesNotesWithoutExtraContent()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbNotes = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == pickupJobId);
            pickupNote!.NoteText.Should().Be("SPLIT Part 1 of 2");
        }
    }

    #endregion

    #region SplitJobAsync Error Tests

    [Fact]
    public async Task SplitJobAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(999, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Job 999 not found*");
    }

    [Fact]
    public async Task SplitJobAsync_JobIsAlreadyChild_ThrowsInvalidOperationException()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var parentJob = CreateTestJob(1, "PARENT-001");
            var childJob = CreateTestJob(2, "CHILD-001", parentId: 1);
            context.TucJobs.AddRange(parentJob, childJob);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(2, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already a child job*");
    }

    [Fact]
    public async Task SplitJobAsync_MissingRelationshipTypes_ThrowsInvalidOperationException()
    {
        // Arrange - Remove relationship types
        await using (var context = CreateContext())
        {
            context.TblJobRelationshipTypes.RemoveRange(context.TblJobRelationshipTypes);
            await context.SaveChangesAsync();

            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*relationship type*not found*");
    }

    [Fact]
    public async Task SplitJobAsync_JobHasChildren_ThrowsInvalidOperationException()
    {
        // Arrange - Create a parent job with existing children
        await using (var context = CreateContext())
        {
            var parentJob = CreateTestJob(1, "PARENT-001");
            parentJob.ParentId = 1; // Self-referencing parent
            var childJob1 = CreateTestJob(2, "PARENT-001-1", parentId: 1);
            var childJob2 = CreateTestJob(3, "PARENT-001-2", parentId: 1);
            context.TucJobs.AddRange(parentJob, childJob1, childJob2);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*has child jobs*cannot be split*");
    }

    #endregion

    #region Speed Validation Tests

    [Fact]
    public async Task SplitJobAsync_ValidSpeed_UsesOriginalSpeed()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = DefaultSpeedId;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob!.UcjbSpeed.Should().Be(DefaultSpeedId);
            deliveryJob!.UcjbSpeed.Should().Be(DefaultSpeedId);
        }
    }

    [Fact]
    public async Task SplitJobAsync_InvalidSpeed_FallsBackToFirstValidSpeed()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = 99999; // Non-existent speed
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Should fall back to DefaultSpeedId (the only valid speed in test data)
            pickupJob!.UcjbSpeed.Should().Be(DefaultSpeedId);
            deliveryJob!.UcjbSpeed.Should().Be(DefaultSpeedId);
        }
    }

    [Fact]
    public async Task SplitJobAsync_NullSpeed_PreservesNullSpeed()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob!.UcjbSpeed.Should().BeNull();
            deliveryJob!.UcjbSpeed.Should().BeNull();
        }
    }

    #endregion

    #region SplitJobBookingAsync Tests

    [Fact]
    public async Task SplitJobBookingAsync_ValidBooking_CreatesPickupAndDeliveryBookings()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var booking = CreateTestJobBooking(1, "BOOK-001");
            context.TucJobBookings.Add(booking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupId, deliveryId) = await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        pickupId.Should().BeGreaterThan(0);
        deliveryId.Should().BeGreaterThan(0);

        await using (var context = CreateContext())
        {
            var pickupBooking = await context.TucJobBookings.FindAsync(pickupId);
            var deliveryBooking = await context.TucJobBookings.FindAsync(deliveryId);

            pickupBooking.Should().NotBeNull();
            deliveryBooking.Should().NotBeNull();
            pickupBooking!.UcbkJobNumber.Should().Be("BOOK-001-1");
            deliveryBooking!.UcbkJobNumber.Should().Be("BOOK-001-2");
        }
    }

    [Fact]
    public async Task SplitJobBookingAsync_ValidBooking_SetsParentChildRelationships()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var booking = CreateTestJobBooking(1, "BOOK-001");
            context.TucJobBookings.Add(booking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupId, deliveryId) = await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentBooking = await context.TucJobBookings.FindAsync(1);
            var pickupBooking = await context.TucJobBookings.FindAsync(pickupId);
            var deliveryBooking = await context.TucJobBookings.FindAsync(deliveryId);

            parentBooking!.JobRelationshipTypeId.Should().Be(ParentRelationshipTypeId);
            parentBooking.ParentId.Should().Be(1);

            pickupBooking!.JobRelationshipTypeId.Should().Be(ChildRelationshipTypeId);
            pickupBooking.ParentId.Should().Be(1);

            deliveryBooking!.JobRelationshipTypeId.Should().Be(ChildRelationshipTypeId);
            deliveryBooking.ParentId.Should().Be(1);
        }
    }

    [Fact]
    public async Task SplitJobBookingAsync_ValidBooking_CreatesNotesInTucNotesTable()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var booking = CreateTestJobBooking(1, "BOOK-001");
            context.TucJobBookings.Add(booking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupId, deliveryId) = await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobBookingId == pickupId);
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobBookingId == deliveryId);

            pickupNote.Should().NotBeNull();
            pickupNote!.NoteText.Should().Contain("SPLIT Part 1 of 2");
            pickupNote.NoteTypeId.Should().Be((int)NoteType.InternalNote);

            deliveryNote.Should().NotBeNull();
            deliveryNote!.NoteText.Should().Contain("SPLIT Part 2 of 2");
        }
    }

    [Fact]
    public async Task SplitJobBookingAsync_BookingNotFound_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobBookingAsync(999, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Job booking 999 not found*");
    }

    [Fact]
    public async Task SplitJobBookingAsync_BookingIsAlreadyChild_ThrowsInvalidOperationException()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var parentBooking = CreateTestJobBooking(1, "PARENT-001");
            var childBooking = CreateTestJobBooking(2, "CHILD-001", parentId: 1);
            context.TucJobBookings.AddRange(parentBooking, childBooking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobBookingAsync(2, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*already a child job*");
    }

    [Fact]
    public async Task SplitJobBookingAsync_BookingHasChildren_ThrowsInvalidOperationException()
    {
        // Arrange - Create a parent booking with existing children
        await using (var context = CreateContext())
        {
            var parentBooking = CreateTestJobBooking(1, "PARENT-001");
            parentBooking.ParentId = 1; // Self-referencing parent
            var childBooking1 = CreateTestJobBooking(2, "PARENT-001-1", parentId: 1);
            var childBooking2 = CreateTestJobBooking(3, "PARENT-001-2", parentId: 1);
            context.TucJobBookings.AddRange(parentBooking, childBooking1, childBooking2);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*has child jobs*cannot be split*");
    }

    #endregion

    #region Address Field Tests

    [Fact]
    public async Task SplitJobAsync_PickupJob_HasMeetingPointDeliveryAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "Final Destination Address";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            pickupJob!.UcjbTo.Should().Be(TestMeetingPointSuburbId);
            pickupJob.UcjbToAddr.Should().Be(meetingPoint.FullAddress);
            pickupJob.DeliveryLatitude.Should().Be(meetingPoint.Latitude);
            pickupJob.DeliveryLongitude.Should().Be(meetingPoint.Longitude);
            pickupJob.DeliveryAddressLine1.Should().Be(meetingPoint.AddressLine1);
            pickupJob.DeliveryAddressLine2.Should().Be(meetingPoint.AddressLine2);
            pickupJob.DeliveryAddressLine3.Should().Be(meetingPoint.AddressLine3);
            pickupJob.DeliveryAddressLine4.Should().Be(meetingPoint.AddressLine4);
            pickupJob.DeliveryAddressLine5.Should().Be(meetingPoint.AddressLine5);
            pickupJob.DeliveryAddressLine6.Should().Be(meetingPoint.AddressLine6);
            pickupJob.DeliveryAddressLine7.Should().Be(meetingPoint.AddressLine7);
            pickupJob.DeliveryAddressLine8.Should().Be(meetingPoint.AddressLine8);
        }
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJob_HasOriginalDeliveryAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "Final Destination Address";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob!.UcjbToAddr.Should().Be("Final Destination Address");
        }
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJob_HasMeetingPointFromAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "Final Destination Address";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob!.UcjbFrom.Should().Be(TestMeetingPointSuburbId);
            deliveryJob.UcjbFromAddr.Should().Be(meetingPoint.FullAddress);
            deliveryJob.PickUpLatitude.Should().Be(meetingPoint.Latitude);
            deliveryJob.PickUpLongitude.Should().Be(meetingPoint.Longitude);
            deliveryJob.PickupAddressLine1.Should().Be(meetingPoint.AddressLine1);
            deliveryJob.PickupAddressLine2.Should().Be(meetingPoint.AddressLine2);
            deliveryJob.PickupAddressLine3.Should().Be(meetingPoint.AddressLine3);
            deliveryJob.PickupAddressLine4.Should().Be(meetingPoint.AddressLine4);
            deliveryJob.PickupAddressLine5.Should().Be(meetingPoint.AddressLine5);
            deliveryJob.PickupAddressLine6.Should().Be(meetingPoint.AddressLine6);
            deliveryJob.PickupAddressLine7.Should().Be(meetingPoint.AddressLine7);
            deliveryJob.PickupAddressLine8.Should().Be(meetingPoint.AddressLine8);
        }
    }

    [Fact]
    public async Task SplitJobAsync_PickupAndDeliveryJobs_HaveMatchingMeetingPointAddresses()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "Final Destination Address";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert - Pickup's TO address should match Delivery's FROM address
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob!.UcjbTo.Should().Be(deliveryJob!.UcjbFrom);
            pickupJob.UcjbToAddr.Should().Be(deliveryJob.UcjbFromAddr);
            pickupJob.DeliveryLatitude.Should().Be(deliveryJob.PickUpLatitude);
            pickupJob.DeliveryLongitude.Should().Be(deliveryJob.PickUpLongitude);
        }
    }

    #endregion

    #region SplitJobBookingAsync Address Tests

    [Fact]
    public async Task SplitJobBookingAsync_DeliveryBooking_HasMeetingPointFromAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var booking = CreateTestJobBooking(1, "BOOK-001");
            booking.UcbkToAddr = "Final Destination Address";
            context.TucJobBookings.Add(booking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryId) = await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryBooking = await context.TucJobBookings.FindAsync(deliveryId);
            deliveryBooking!.UcbkFrom.Should().Be(TestMeetingPointSuburbId);
            deliveryBooking.UcbkFromAddr.Should().Be(meetingPoint.FullAddress);
        }
    }

    [Fact]
    public async Task SplitJobBookingAsync_PickupAndDeliveryBookings_HaveMatchingMeetingPointAddresses()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var booking = CreateTestJobBooking(1, "BOOK-001");
            booking.UcbkToAddr = "Final Destination Address";
            context.TucJobBookings.Add(booking);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupId, deliveryId) = await service.SplitJobBookingAsync(1, "TestUser", TestMeetingPointSuburbId, meetingPoint);

        // Assert - Pickup's TO address should match Delivery's FROM address
        await using (var context = CreateContext())
        {
            var pickupBooking = await context.TucJobBookings.FindAsync(pickupId);
            var deliveryBooking = await context.TucJobBookings.FindAsync(deliveryId);

            pickupBooking!.UcbkTo.Should().Be(deliveryBooking!.UcbkFrom);
            pickupBooking.UcbkToAddr.Should().Be(deliveryBooking.UcbkFromAddr);
        }
    }

    #endregion
}
