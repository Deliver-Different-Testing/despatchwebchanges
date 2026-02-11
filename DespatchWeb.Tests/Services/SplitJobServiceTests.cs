using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
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
    private readonly Mock<IRateJobService> _rateJobServiceMock = new();
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();

    private const int ParentRelationshipTypeId = 1;
    private const int ChildRelationshipTypeId = 2;
    private const int DefaultSpeedId = 100;
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
        _tenantInfoServiceMock.Object,
        _rateJobServiceMock.Object,
        _jobRepositoryMock.Object
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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // First split creates A and B suffixes
            pickupJob!.UcjbNumber.Should().Be("JOB-001A");
            deliveryJob!.UcjbNumber.Should().Be("JOB-001B");
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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var act = async () => await service.SplitJobAsync(999, "TestUser", meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Job 999 not found*");
    }

    [Fact]
    public async Task SplitJobAsync_ChildJob_SuccessfullySplits()
    {
        // Arrange - Create a parent job with a child job that we'll split
        await using (var context = CreateContext())
        {
            var parentJob = CreateTestJob(1, "PARENT-001");
            parentJob.ParentId = 1;
            parentJob.RootParentId = 1;
            var childJob = CreateTestJob(2, "PARENT-001A", parentId: 1);
            childJob.RootParentId = 1;
            context.TucJobs.AddRange(parentJob, childJob);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split the child job
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(2, "TestUser", meetingPoint);

        // Assert
        pickupJobId.Should().BeGreaterThan(0);
        deliveryJobId.Should().BeGreaterThan(0);

        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Both new jobs should have the child job (2) as their ParentId
            pickupJob!.ParentId.Should().Be(2);
            deliveryJob!.ParentId.Should().Be(2);

            // Both should share the original root parent
            pickupJob.RootParentId.Should().Be(1);
            deliveryJob.RootParentId.Should().Be(1);
        }
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
        var act = async () => await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*relationship type*not found*");
    }

    [Fact]
    public async Task SplitJobAsync_JobWithFlightAssigned_ThrowsInvalidOperationException()
    {
        // Arrange - Create a job with a flight assigned
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();

            // Add a flight assignment
            context.TucJobNationwides.Add(new TucJobNationwide
            {
                UcnwJobId = 1,
                UcnwJobNumber = "JOB-001",
                UcnwClientId = 1,
                UcnwDestinationId = 1,
                UcnwItb = 0,
                UcnwPickUpJobId = 0,
                UcnwDeliveryJobId = 0,
                UcnwAirportOnly = false,
                UcnwLegNumber = 1
            });
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*has flights assigned*cannot be split*");
    }

    [Fact]
    public async Task SplitJobAsync_JobWithExistingChildren_CanStillBeSplit()
    {
        // Arrange - Create a parent job with existing children
        await using (var context = CreateContext())
        {
            var parentJob = CreateTestJob(1, "PARENT-001");
            parentJob.ParentId = 1;
            parentJob.RootParentId = 1;
            var childJob1 = CreateTestJob(2, "PARENT-001A", parentId: 1);
            childJob1.RootParentId = 1;
            var childJob2 = CreateTestJob(3, "PARENT-001B", parentId: 1);
            childJob2.RootParentId = 1;
            context.TucJobs.AddRange(parentJob, childJob1, childJob2);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split the parent job again (this should now be allowed)
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        pickupJobId.Should().BeGreaterThan(0);
        deliveryJobId.Should().BeGreaterThan(0);

        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // New jobs should have letter suffixes continuing from existing children
            pickupJob!.UcjbNumber.Should().Be("PARENT-001C");
            deliveryJob!.UcjbNumber.Should().Be("PARENT-001D");
        }
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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            pickupJob!.UcjbTo.Should().BeNull();
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
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob!.UcjbFrom.Should().BeNull();
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
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

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

    #region No Suburb ID Behavior Tests

    [Fact]
    public async Task SplitJobAsync_MeetingPointSuburbId_IsNullForPickupDelivery()
    {
        // Arrange - This test verifies the fix for the "Invalid meeting point address" error
        // When splitting a job, the meeting point suburb IDs should be null since
        // HERE Maps lookup doesn't provide suburb IDs, and we use address lines instead
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbFrom = 100; // Original pickup suburb
            job.UcjbTo = 200; // Original delivery suburb
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Meeting point suburb IDs should be null (pickup's To, delivery's From)
            pickupJob!.UcjbTo.Should().BeNull("pickup job's delivery suburb should be null for meeting point");
            deliveryJob!.UcjbFrom.Should().BeNull("delivery job's pickup suburb should be null for meeting point");

            // But the address text and coordinates should be set correctly
            pickupJob.UcjbToAddr.Should().Be(meetingPoint.FullAddress);
            deliveryJob.UcjbFromAddr.Should().Be(meetingPoint.FullAddress);
        }
    }

    [Fact]
    public async Task SplitJobAsync_OriginalPickupSuburb_IsPreservedOnPickupJob()
    {
        // Arrange
        const int originalPickupSuburbId = 100;
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbFrom = originalPickupSuburbId;
            job.UcjbFromAddr = "123 Original Pickup St";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, _) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Pickup job should keep the original pickup suburb
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            pickupJob!.UcjbFrom.Should().Be(originalPickupSuburbId);
            pickupJob.UcjbFromAddr.Should().Be("123 Original Pickup St");
        }
    }

    [Fact]
    public async Task SplitJobAsync_OriginalDeliverySuburb_IsPreservedOnDeliveryJob()
    {
        // Arrange
        const int originalDeliverySuburbId = 200;
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbTo = originalDeliverySuburbId;
            job.UcjbToAddr = "456 Final Destination Ave";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Delivery job should keep the original delivery suburb
        await using (var context = CreateContext())
        {
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob!.UcjbTo.Should().Be(originalDeliverySuburbId);
            deliveryJob.UcjbToAddr.Should().Be("456 Final Destination Ave");
        }
    }

    [Fact]
    public async Task SplitJobAsync_AddressLinesUsedInsteadOfSuburbId()
    {
        // Arrange - Verifies that address lines 1-8 are the primary identifier
        // for the meeting point, not the suburb ID
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - All 8 address lines should be populated for meeting point
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Pickup job delivery address (meeting point)
            pickupJob!.DeliveryAddressLine1.Should().Be(meetingPoint.AddressLine1);
            pickupJob.DeliveryAddressLine2.Should().Be(meetingPoint.AddressLine2);
            pickupJob.DeliveryAddressLine3.Should().Be(meetingPoint.AddressLine3);
            pickupJob.DeliveryAddressLine4.Should().Be(meetingPoint.AddressLine4);
            pickupJob.DeliveryAddressLine5.Should().Be(meetingPoint.AddressLine5);
            pickupJob.DeliveryAddressLine6.Should().Be(meetingPoint.AddressLine6);
            pickupJob.DeliveryAddressLine7.Should().Be(meetingPoint.AddressLine7); // ZIP code
            pickupJob.DeliveryAddressLine8.Should().Be(meetingPoint.AddressLine8);

            // Delivery job pickup address (meeting point)
            deliveryJob!.PickupAddressLine1.Should().Be(meetingPoint.AddressLine1);
            deliveryJob.PickupAddressLine2.Should().Be(meetingPoint.AddressLine2);
            deliveryJob.PickupAddressLine3.Should().Be(meetingPoint.AddressLine3);
            deliveryJob.PickupAddressLine4.Should().Be(meetingPoint.AddressLine4);
            deliveryJob.PickupAddressLine5.Should().Be(meetingPoint.AddressLine5);
            deliveryJob.PickupAddressLine6.Should().Be(meetingPoint.AddressLine6);
            deliveryJob.PickupAddressLine7.Should().Be(meetingPoint.AddressLine7); // ZIP code
            deliveryJob.PickupAddressLine8.Should().Be(meetingPoint.AddressLine8);
        }
    }

    [Fact]
    public async Task SplitJobAsync_CoordinatesUsedForMeetingPoint()
    {
        // Arrange - Verifies that coordinates are set for the meeting point
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Meeting point coordinates should be set on both jobs
            pickupJob!.DeliveryLatitude.Should().Be(meetingPoint.Latitude);
            pickupJob.DeliveryLongitude.Should().Be(meetingPoint.Longitude);

            deliveryJob!.PickUpLatitude.Should().Be(meetingPoint.Latitude);
            deliveryJob.PickUpLongitude.Should().Be(meetingPoint.Longitude);
        }
    }

    #endregion

    #region Post-Split Operations Tests (US Tenant Fix)

    [Fact]
    public async Task SplitJobAsync_PostSplitStoredProcsUnavailable_SplitStillSucceeds()
    {
        // Verifies the fix for the US tenant 500 error.
        // Stored procs (DES_stpJob_SplitJob_ReRate, DES_stpJob_ColsolidateMarsInformation)
        // are unavailable on SQLite, simulating the US tenant failure where
        // XACT_ABORT ON in the stored proc would doom the outer C# transaction.
        // The split should succeed regardless since post-split ops now run outside the transaction.

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbFrom = 100;
            job.UcjbTo = null; // US-style: no suburb ID for delivery side
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Should not throw even though stored procs will fail
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Split completed successfully
        pickupJobId.Should().BeGreaterThan(0);
        deliveryJobId.Should().BeGreaterThan(0);

        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            pickupJob.Should().NotBeNull();
            deliveryJob.Should().NotBeNull();

            // Core split data is intact
            pickupJob.ParentId.Should().Be(1);
            deliveryJob.ParentId.Should().Be(1);
            pickupJob.Sequence.Should().Be(1);
            deliveryJob.Sequence.Should().Be(2);
        }
    }

    [Fact]
    public async Task SplitJobAsync_PostSplitOps_UseFreshDbContextInstances()
    {
        // Verifies that post-split operations create fresh DbContext instances
        // (separate from the transaction context) to avoid XACT_ABORT contamination

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
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Context factory should be called 3 times:
        // 1x for the main transaction, 2x for post-split operations (re-rate + MARS)
        _contextFactoryMock.Verify(
            f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()),
            Times.Exactly(3));
    }

    [Fact]
    public async Task SplitJobAsync_PostSplitContextCreationFails_SplitStillReturnsSuccessfully()
    {
        // Verifies that if creating a fresh context for post-split operations fails,
        // the already-committed split result is still returned

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var callCount = 0;
        var failingContextFactoryMock = new Mock<IDbContextFactory<DespatchContext>>();
        failingContextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount > 1) throw new InvalidOperationException("DB connection pool exhausted");
                return new DespatchContext(_dbOptions);
            });

        var service = new SplitJobService(failingContextFactoryMock.Object, _tenantInfoServiceMock.Object, _rateJobServiceMock.Object, _jobRepositoryMock.Object);
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Should not throw; post-split failures are caught
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Split completed
        pickupJobId.Should().BeGreaterThan(0);
        deliveryJobId.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task SplitJobAsync_DataCommittedBeforePostSplitOps_TransactionIntegrity()
    {
        // Verifies that split job data is committed to the database BEFORE
        // post-split operations run, ensuring data survives post-split failures

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 42;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - All transaction data persisted despite post-split stored procs failing
        await using (var context = CreateContext())
        {
            // Parent job modifications committed
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.JobRelationshipTypeId.Should().Be(ParentRelationshipTypeId);
            parentJob.ParentId.Should().Be(1);
            parentJob.RootParentId.Should().Be(1);

            // Child jobs committed
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            pickupJob.Should().NotBeNull();
            deliveryJob.Should().NotBeNull();

            // Notes committed
            var notes = await context.TucNotes
                .Where(n => n.JobId == pickupJobId || n.JobId == deliveryJobId)
                .ToListAsync();
            notes.Should().HaveCount(2);

            // Display in despatch updated
            var allChildJobs = await context.TucJobs
                .Where(j => j.RootParentId == 1 && j.UcjbId != 1)
                .ToListAsync();
            allChildJobs.Should().AllSatisfy(j => j.DisplayInDespatch.Should().BeTrue());
        }
    }

    [Fact]
    public async Task SplitJobAsync_NullSuburbIds_USStyleAddress_CompleteSplitSuccessfully()
    {
        // Simulates a US tenant split where suburb IDs don't exist.
        // The original bug: NULL suburb IDs caused stored proc rating functions to fail,
        // which with XACT_ABORT ON doomed the outer C# transaction.
        // After the fix, the split completes and re-rating failure is non-fatal.

        // Arrange - Job with no suburb IDs (US-style)
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "US-JOB-001");
            job.UcjbFrom = null; // No NZ suburb lookup
            job.UcjbFromAddr = "350 Fifth Avenue, New York, NY 10118";
            job.UcjbTo = null; // No NZ suburb lookup
            job.UcjbToAddr = "1600 Pennsylvania Avenue NW, Washington, DC 20500";
            job.UcjbCourierId = 50;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = new AddressViewModel(
            addressLine1: "Suite 200",
            addressLine2: "Meeting Hub",
            addressLine3: "789",
            addressLine4: "Market Street",
            addressLine5: "Philadelphia",
            addressLine6: "PA",
            addressLine7: "19103",
            addressLine8: ""
        )
        {
            Latitude = 39.9526m,
            Longitude = -75.1652m
        };

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Pickup: original From (null) -> meeting point (null suburb, address set)
            pickupJob!.UcjbFrom.Should().BeNull();
            pickupJob.UcjbFromAddr.Should().Be("350 Fifth Avenue, New York, NY 10118");
            pickupJob.UcjbTo.Should().BeNull();
            pickupJob.UcjbToAddr.Should().Be(meetingPoint.FullAddress);
            pickupJob.UcjbCourierId.Should().Be(50);

            // Delivery: meeting point (null suburb, address set) -> original To (null)
            deliveryJob!.UcjbFrom.Should().BeNull();
            deliveryJob.UcjbFromAddr.Should().Be(meetingPoint.FullAddress);
            deliveryJob.UcjbTo.Should().BeNull();
            deliveryJob.UcjbToAddr.Should().Be("1600 Pennsylvania Avenue NW, Washington, DC 20500");
            deliveryJob.UcjbCourierId.Should().BeNull();

            // Meeting point address lines populated
            pickupJob.DeliveryAddressLine1.Should().Be("Suite 200");
            pickupJob.DeliveryAddressLine5.Should().Be("Philadelphia");
            pickupJob.DeliveryAddressLine7.Should().Be("19103");

            deliveryJob.PickupAddressLine1.Should().Be("Suite 200");
            deliveryJob.PickupAddressLine5.Should().Be("Philadelphia");
            deliveryJob.PickupAddressLine7.Should().Be("19103");

            // Coordinates set
            pickupJob.DeliveryLatitude.Should().Be(39.9526m);
            pickupJob.DeliveryLongitude.Should().Be(-75.1652m);
            deliveryJob.PickUpLatitude.Should().Be(39.9526m);
            deliveryJob.PickUpLongitude.Should().Be(-75.1652m);

            // Job numbers correct
            pickupJob.UcjbNumber.Should().Be("US-JOB-001A");
            deliveryJob.UcjbNumber.Should().Be("US-JOB-001B");
        }
    }

    [Fact]
    public async Task SplitJobAsync_TransactionRollsBack_WhenCoreOperationFails_PostSplitOpsNotRun()
    {
        // Verifies that if the core split fails (e.g., job not found),
        // the transaction is rolled back and post-split ops are never reached

        // Arrange - No job in the database
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(999, "TestUser", meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>();

        // Context factory called only once (for the main transaction context),
        // not 3 times (no post-split contexts created)
        _contextFactoryMock.Verify(
            f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()),
            Times.Once);
    }

    #endregion

    #region GetLetterSuffix Tests

    [Theory]
    [InlineData(0, "A")]
    [InlineData(1, "B")]
    [InlineData(25, "Z")]
    [InlineData(26, "AA")]
    [InlineData(27, "AB")]
    [InlineData(51, "AZ")]
    [InlineData(52, "BA")]
    [InlineData(701, "ZZ")]
    [InlineData(702, "AAA")]
    public void GetLetterSuffix_VariousIndices_ReturnsCorrectLetters(int index, string expected)
    {
        // Act
        var result = SplitJobService.GetLetterSuffix(index);

        // Assert
        result.Should().Be(expected);
    }

    [Fact]
    public async Task SplitJobAsync_MultipleGenerations_CorrectLetterSequence()
    {
        // Arrange - Create a job with existing children A and B
        await using (var context = CreateContext())
        {
            var rootJob = CreateTestJob(1, "JOB-001");
            rootJob.ParentId = 1;
            rootJob.RootParentId = 1;

            var childA = CreateTestJob(2, "JOB-001A", parentId: 1);
            childA.RootParentId = 1;

            var childB = CreateTestJob(3, "JOB-001B", parentId: 1);
            childB.RootParentId = 1;

            context.TucJobs.AddRange(rootJob, childA, childB);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split child A (should create C and D)
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(2, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Should continue with C and D based on existing children count under root
            pickupJob!.UcjbNumber.Should().Be("JOB-001C");
            deliveryJob!.UcjbNumber.Should().Be("JOB-001D");
        }
    }

    #endregion

    #region ReRateSplitJobs Tests

    [Fact]
    public async Task SplitJobAsync_ReRate_UsTenant_DistributesParentAmountProportionally()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(60m)
            .ReturnsAsync(40m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // 60/(60+40) * 100 = 60, last child = 100 - 60 = 40
            pickupJob!.UcjbAmount.Should().Be(60m);
            deliveryJob!.UcjbAmount.Should().Be(40m);
            pickupJob.RatedManually.Should().BeFalse();
            deliveryJob.RatedManually.Should().BeFalse();
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_NzTenant_DistributesParentAmountProportionally()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 200m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingNzAsync(It.IsAny<int>(), false))
            .ReturnsAsync(new JobRatingDetailsDtoNz());
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateNzAsync(It.IsAny<JobRatingDetailsDtoNz>()))
            .ReturnsAsync(75m)
            .ReturnsAsync(25m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // 75/(75+25) * 200 = 150, last child = 200 - 150 = 50
            pickupJob!.UcjbAmount.Should().Be(150m);
            deliveryJob!.UcjbAmount.Should().Be(50m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_LastChildAbsorbsRoundingDifference()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        // Rates that cause rounding: 1/3 and 2/3
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(10m)
            .ReturnsAsync(20m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // 10/30 * 100 = 33.33 (rounded), last child = 100 - 33.33 = 66.67
            pickupJob!.UcjbAmount.Should().Be(33.33m);
            deliveryJob!.UcjbAmount.Should().Be(66.67m);
            (pickupJob.UcjbAmount!.Value + deliveryJob.UcjbAmount!.Value).Should().Be(100m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_AllRatesZero_DistributesEvenly()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        _rateJobServiceMock.Setup(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(0m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // Even distribution: 100/2 = 50 each, last child absorbs remainder
            pickupJob!.UcjbAmount.Should().Be(50m);
            deliveryJob!.UcjbAmount.Should().Be(50m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_ChildRatingFailure_UsesZeroForFailedChild()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        // First child rating throws, second succeeds
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ThrowsAsync(new InvalidOperationException("Rating service unavailable"))
            .ReturnsAsync(50m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var pickupJob = await context.TucJobs.FindAsync(pickupJobId);
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);

            // First child rate = 0 (failed), second = 50. Total = 50.
            // First: 0/50 * 100 = 0. Last child: 100 - 0 = 100.
            pickupJob!.UcjbAmount.Should().Be(0m);
            deliveryJob!.UcjbAmount.Should().Be(100m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_ParentAmountZero_SkipsReRating()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 0m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - rating services should never be called
        _rateJobServiceMock.Verify(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()), Times.Never);
        _rateJobServiceMock.Verify(r => r.GetJobRateNzAsync(It.IsAny<JobRatingDetailsDtoNz>()), Times.Never);
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_ParentAmountNull_SkipsReRating()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - rating services should never be called
        _rateJobServiceMock.Verify(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()), Times.Never);
        _rateJobServiceMock.Verify(r => r.GetJobRateNzAsync(It.IsAny<JobRatingDetailsDtoNz>()), Times.Never);
    }

    #endregion
}