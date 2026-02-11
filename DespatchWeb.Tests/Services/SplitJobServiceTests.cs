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
/// In the new model the existing job becomes the pickup leg (updated in-place) and
/// a single delivery child job is created via the CreateMinimalTucJob stored procedure.
/// Since the SP cannot run in SQLite, CreateMinimalTucJobAsync is mocked.
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
    /// <summary>ID used for the delivery job pre-inserted to represent the SP's output.</summary>
    private const int SpDeliveryJobId = 1000;

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

    /// <summary>
    /// Pre-inserts a skeleton delivery job in the DB (to simulate the SP's output)
    /// and configures the mock to return its ID.
    /// </summary>
    private void SetupDeliveryJobMock(int deliveryJobId = SpDeliveryJobId)
    {
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = deliveryJobId,
                UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today,
                UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId,
                UcjbStatus = 1,
                UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = deliveryJobId });
    }

    #region SplitJobAsync Success Tests

    [Fact]
    public async Task SplitJobAsync_ValidJob_ReturnsOriginalAsPickupAndCreatesDelivery()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — pickup IS the original job
        pickupJobId.Should().Be(1);
        deliveryJobId.Should().Be(SpDeliveryJobId);

        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);
            parentJob.Should().NotBeNull();
            deliveryJob.Should().NotBeNull();
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_DeliveryChildGetsLetterSuffix()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — SP was called with correct job number (first split = A suffix)
        capturedInput.Should().NotBeNull();
        capturedInput!.JobNumber.Should().Be("JOB-001A");
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_SetsParentChildRelationships()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // Parent job has parent relationship type
            parentJob!.JobRelationshipTypeId.Should().Be(ParentRelationshipTypeId);
            parentJob.ParentId.Should().Be(1);
            parentJob.RootParentId.Should().Be(1);

            // Delivery child has child relationship type and points to parent
            deliveryJob!.JobRelationshipTypeId.Should().Be(ChildRelationshipTypeId);
            deliveryJob.ParentId.Should().Be(1);
            deliveryJob.RootParentId.Should().Be(1);
            deliveryJob.Sequence.Should().Be(1);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_ParentKeepsCourier()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 123;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — parent IS the pickup leg and keeps its courier
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.UcjbCourierId.Should().Be(123);
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

        SetupDeliveryJobMock();
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

    #region SplitJobAsync Note Tests

    [Fact]
    public async Task SplitJobAsync_ValidJob_CreatesNoteForDeliveryChild()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == deliveryJobId);
            deliveryNote.Should().NotBeNull();
            deliveryNote!.NoteText.Should().Contain("SPLIT delivery leg");
            deliveryNote.NoteTypeId.Should().Be((int)NoteType.InternalNote);
            deliveryNote.CreatedBy.Should().Be(StaffId);
        }
    }

    [Fact]
    public async Task SplitJobAsync_JobWithNotes_IncludesOriginalNotesInDeliveryNote()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbNotes = "Important delivery instructions";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == deliveryJobId);
            deliveryNote!.NoteText.Should().Contain("Important delivery instructions");
        }
    }

    [Fact]
    public async Task SplitJobAsync_JobWithNoNotes_CreatesNoteWithoutExtraContent()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbNotes = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (_, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var deliveryNote = await context.TucNotes.FirstOrDefaultAsync(n => n.JobId == deliveryJobId);
            deliveryNote!.NoteText.Should().Be("SPLIT delivery leg.");
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

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split the child job (job 2 becomes pickup, delivery child created)
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(2, "TestUser", meetingPoint);

        // Assert
        pickupJobId.Should().Be(2);
        deliveryJobId.Should().Be(SpDeliveryJobId);

        await using (var context = CreateContext())
        {
            var splitJob = await context.TucJobs.FindAsync(2);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // The split job (2) keeps its ParentId=1, RootParentId=1
            splitJob!.ParentId.Should().Be(1);
            splitJob.RootParentId.Should().Be(1);

            // Delivery child points to the split job as parent
            deliveryJob!.ParentId.Should().Be(2);
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

            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
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
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();

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

        // Capture the job number sent to the SP
        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split the parent job again
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        pickupJobId.Should().Be(1);
        deliveryJobId.Should().Be(SpDeliveryJobId);

        // Delivery child gets next letter suffix (C, after existing A and B)
        capturedInput.Should().NotBeNull();
        capturedInput!.JobNumber.Should().Be("PARENT-001C");
    }

    #endregion

    #region Speed Validation Tests

    [Fact]
    public async Task SplitJobAsync_ValidSpeed_PassesOriginalSpeedToSP()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = DefaultSpeedId;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        capturedInput!.SpeedId.Should().Be(DefaultSpeedId);
    }

    [Fact]
    public async Task SplitJobAsync_InvalidSpeed_PassesFallbackSpeedToSP()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = 99999; // Non-existent speed
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — falls back to the only valid speed in test data
        capturedInput!.SpeedId.Should().Be(DefaultSpeedId);
    }

    [Fact]
    public async Task SplitJobAsync_NullSpeed_PassesZeroSpeedToSP()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbSpeed = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — null speed becomes 0 in the SP input
        capturedInput!.SpeedId.Should().Be(0);
    }

    #endregion

    #region Address Field Tests

    [Fact]
    public async Task SplitJobAsync_ParentJob_GetsMeetingPointDeliveryAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "Final Destination Address";
            job.DeliveryAddressLine1 = "Final";
            job.DeliveryAddressLine5 = "Destination City";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — parent's delivery address is now the meeting point
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.UcjbTo.Should().BeNull();
            parentJob.UcjbToAddr.Should().Be(meetingPoint.FullAddress);
            parentJob.DeliveryLatitude.Should().Be(meetingPoint.Latitude);
            parentJob.DeliveryLongitude.Should().Be(meetingPoint.Longitude);
            parentJob.DeliveryAddressLine1.Should().Be(meetingPoint.AddressLine1);
            parentJob.DeliveryAddressLine2.Should().Be(meetingPoint.AddressLine2);
            parentJob.DeliveryAddressLine3.Should().Be(meetingPoint.AddressLine3);
            parentJob.DeliveryAddressLine4.Should().Be(meetingPoint.AddressLine4);
            parentJob.DeliveryAddressLine5.Should().Be(meetingPoint.AddressLine5);
            parentJob.DeliveryAddressLine6.Should().Be(meetingPoint.AddressLine6);
            parentJob.DeliveryAddressLine7.Should().Be(meetingPoint.AddressLine7);
            parentJob.DeliveryAddressLine8.Should().Be(meetingPoint.AddressLine8);
        }
    }

    [Fact]
    public async Task SplitJobAsync_SPInput_HasOriginalDeliveryAsToAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbToAddr = "456 Delivery Ave";
            job.DeliveryAddressLine1 = "Unit 10";
            job.DeliveryAddressLine5 = "Delivery City";
            job.DeliveryLatitude = -37.0m;
            job.DeliveryLongitude = 175.0m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — SP receives original delivery address as ToAddress
        capturedInput!.ToAddress.AddressLine1.Should().Be("Unit 10");
        capturedInput.ToAddress.AddressLine5.Should().Be("Delivery City");
        capturedInput.DeliveryLatitude.Should().Be(-37.0m);
        capturedInput.DeliveryLongitude.Should().Be(175.0m);
    }

    [Fact]
    public async Task SplitJobAsync_SPInput_HasMeetingPointAsFromAddress()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — SP receives meeting point as FromAddress
        capturedInput!.FromAddress.FullAddress.Should().Be(meetingPoint.FullAddress);
        capturedInput.PickUpLatitude.Should().Be(meetingPoint.Latitude);
        capturedInput.PickUpLongitude.Should().Be(meetingPoint.Longitude);
    }

    [Fact]
    public async Task SplitJobAsync_ParentPickupAddress_IsPreserved()
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

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — parent's pickup address is unchanged
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.UcjbFrom.Should().Be(originalPickupSuburbId);
            parentJob.UcjbFromAddr.Should().Be("123 Original Pickup St");
        }
    }

    [Fact]
    public async Task SplitJobAsync_ParentHandoffFields_SetCorrectly()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.DeliverToContact = "John Doe";
            job.DeliverToPhone = "555-1234";
            job.DeliverToPrivateBusiness = 2;
            job.DeliverToLeaveId = 5;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — parent's handoff fields are set for meeting point
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.DeliverToLeaveId.Should().Be(23); // HandOffLeaveType
            parentJob.DeliverToPrivateBusiness.Should().Be(1); // PrivateResidenceDeliverTo
            parentJob.DeliverToContact.Should().BeNull();
            parentJob.DeliverToPhone.Should().BeNull();
        }
    }

    [Fact]
    public async Task SplitJobAsync_SPInput_ReceivesOriginalContactDetails()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.DeliverToContact = "John Doe";
            job.DeliverToPhone = "555-1234";
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — SP receives original delivery contact details
        capturedInput!.ToContactName.Should().Be("John Doe");
        capturedInput.ToPhoneNumber.Should().Be("555-1234");
    }

    #endregion

    #region Post-Split Operations Tests

    [Fact]
    public async Task SplitJobAsync_PostSplitStoredProcsUnavailable_SplitStillSucceeds()
    {
        // Verifies the fix for the US tenant 500 error.
        // Post-split ops (re-rate, MARS consolidation) run outside the transaction
        // so their failures are non-fatal.

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbFrom = 100;
            job.UcjbTo = null;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Should not throw even though stored procs will fail
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Split completed successfully
        pickupJobId.Should().Be(1);
        deliveryJobId.Should().Be(SpDeliveryJobId);

        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);
            parentJob.Should().NotBeNull();
            deliveryJob.Should().NotBeNull();
            parentJob!.ParentId.Should().Be(1);
            deliveryJob!.ParentId.Should().Be(1);
            deliveryJob.Sequence.Should().Be(1);
        }
    }

    [Fact]
    public async Task SplitJobAsync_PostSplitOps_UseFreshDbContextInstances()
    {
        // Verifies that post-split operations create fresh DbContext instances

        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Context factory called 3 times:
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
            context.TucJobs.Add(CreateTestJob(1, "JOB-001"));
            await context.SaveChangesAsync();
        }

        // Pre-insert delivery job
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var callCount = 0;
        var failingContextFactoryMock = new Mock<IDbContextFactory<DespatchContext>>();
        failingContextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                if (callCount > 1) throw new InvalidOperationException("DB connection pool exhausted");
                return new DespatchContext(_dbOptions);
            });

        var service = new SplitJobService(failingContextFactoryMock.Object, _tenantInfoServiceMock.Object,
            _rateJobServiceMock.Object, _jobRepositoryMock.Object);
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Should not throw; post-split failures are caught
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - Split completed
        pickupJobId.Should().Be(1);
        deliveryJobId.Should().Be(SpDeliveryJobId);
    }

    [Fact]
    public async Task SplitJobAsync_DataCommittedBeforePostSplitOps_TransactionIntegrity()
    {
        // Verifies that split job data is committed to the database BEFORE
        // post-split operations run

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbCourierId = 42;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var (pickupJobId, deliveryJobId) = await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert - All transaction data persisted
        await using (var context = CreateContext())
        {
            // Parent job modifications committed
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.JobRelationshipTypeId.Should().Be(ParentRelationshipTypeId);
            parentJob.ParentId.Should().Be(1);
            parentJob.RootParentId.Should().Be(1);
            parentJob.UcjbCourierId.Should().Be(42); // Parent keeps courier

            // Delivery child committed
            var deliveryJob = await context.TucJobs.FindAsync(deliveryJobId);
            deliveryJob.Should().NotBeNull();

            // Note committed
            var notes = await context.TucNotes
                .Where(n => n.JobId == deliveryJobId)
                .ToListAsync();
            notes.Should().HaveCount(1);

            // Display in despatch updated for child
            var childJobs = await context.TucJobs
                .Where(j => j.RootParentId == 1 && j.UcjbId != 1)
                .ToListAsync();
            childJobs.Should().AllSatisfy(j => j.DisplayInDespatch.Should().BeTrue());
        }
    }

    [Fact]
    public async Task SplitJobAsync_NullSuburbIds_USStyleAddress_CompleteSplitSuccessfully()
    {
        // Simulates a US tenant split where suburb IDs don't exist

        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "US-JOB-001");
            job.UcjbFrom = null;
            job.UcjbFromAddr = "350 Fifth Avenue, New York, NY 10118";
            job.UcjbTo = null;
            job.UcjbToAddr = "1600 Pennsylvania Avenue NW, Washington, DC 20500";
            job.UcjbCourierId = 50;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();
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
        pickupJobId.Should().Be(1);
        deliveryJobId.Should().Be(SpDeliveryJobId);

        await using (var context = CreateContext())
        {
            // Parent (pickup): keeps original From, destination changed to meeting point
            var parentJob = await context.TucJobs.FindAsync(1);
            parentJob!.UcjbFrom.Should().BeNull();
            parentJob.UcjbFromAddr.Should().Be("350 Fifth Avenue, New York, NY 10118");
            parentJob.UcjbTo.Should().BeNull();
            parentJob.UcjbToAddr.Should().Be(meetingPoint.FullAddress);
            parentJob.UcjbCourierId.Should().Be(50); // Keeps courier

            // Meeting point address lines on parent
            parentJob.DeliveryAddressLine1.Should().Be("Suite 200");
            parentJob.DeliveryAddressLine5.Should().Be("Philadelphia");
            parentJob.DeliveryAddressLine7.Should().Be("19103");
            parentJob.DeliveryLatitude.Should().Be(39.9526m);
            parentJob.DeliveryLongitude.Should().Be(-75.1652m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_TransactionRollsBack_WhenCoreOperationFails_PostSplitOpsNotRun()
    {
        // Verifies that if the core split fails, post-split ops are never reached

        // Arrange - No job in the database
        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        var act = async () => await service.SplitJobAsync(999, "TestUser", meetingPoint);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>();

        // Context factory called only once (for the main transaction context)
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
        var result = SplitJobService.GetLetterSuffix(index);
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

        // Capture job number
        CreateMinimalTucJobInputModel capturedInput = null;
        using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = SpDeliveryJobId, UcjbNumber = "SP-PLACEHOLDER",
                UcjbDate = DateTime.Today, UcjbTime = DateTime.Now,
                UcjbSpeed = DefaultSpeedId, UcjbStatus = 1, UcjbClientId = 1
            });
            context.SaveChanges();
        }

        _jobRepositoryMock.Setup(r => r.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>()))
            .Callback<CreateMinimalTucJobInputModel, CancellationToken>((input, _) => capturedInput = input)
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = SpDeliveryJobId });

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act - Split child A (should create C, continuing from existing A+B)
        await service.SplitJobAsync(2, "TestUser", meetingPoint);

        // Assert
        capturedInput!.JobNumber.Should().Be("JOB-001C");
    }

    #endregion

    #region ReRateSplitJobs Tests

    [Fact]
    public async Task SplitJobAsync_ReRate_UsTenant_DistributesAmountProportionally()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(60m)  // parent (pickup) rate
            .ReturnsAsync(40m); // delivery child rate

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert — amounts distributed proportionally
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // 60/(60+40) * 100 = 60, last job = 100 - 60 = 40
            parentJob!.UcjbAmount.Should().Be(60m);
            deliveryJob!.UcjbAmount.Should().Be(40m);
            parentJob.RatedManually.Should().BeFalse();
            deliveryJob.RatedManually.Should().BeFalse();
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_NzTenant_DistributesAmountProportionally()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 200m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(false);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingNzAsync(It.IsAny<int>(), false))
            .ReturnsAsync(new JobRatingDetailsDtoNz());
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateNzAsync(It.IsAny<JobRatingDetailsDtoNz>()))
            .ReturnsAsync(75m)
            .ReturnsAsync(25m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // 75/(75+25) * 200 = 150, last job = 200 - 150 = 50
            parentJob!.UcjbAmount.Should().Be(150m);
            deliveryJob!.UcjbAmount.Should().Be(50m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_LastJobAbsorbsRoundingDifference()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(10m)
            .ReturnsAsync(20m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // 10/30 * 100 = 33.33 (rounded), last job = 100 - 33.33 = 66.67
            parentJob!.UcjbAmount.Should().Be(33.33m);
            deliveryJob!.UcjbAmount.Should().Be(66.67m);
            (parentJob.UcjbAmount!.Value + deliveryJob.UcjbAmount!.Value).Should().Be(100m);
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

        SetupDeliveryJobMock();

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        _rateJobServiceMock.Setup(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ReturnsAsync(0m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            parentJob!.UcjbAmount.Should().Be(50m);
            deliveryJob!.UcjbAmount.Should().Be(50m);
        }
    }

    [Fact]
    public async Task SplitJobAsync_ReRate_RatingFailure_UsesZeroForFailedJob()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            var job = CreateTestJob(1, "JOB-001");
            job.UcjbAmount = 100m;
            context.TucJobs.Add(job);
            await context.SaveChangesAsync();
        }

        SetupDeliveryJobMock();

        _tenantInfoServiceMock.Setup(t => t.IsUsTenant()).Returns(true);
        _jobRepositoryMock.Setup(r => r.GetJobDetailsForRatingAsync(It.IsAny<int>()))
            .ReturnsAsync(new JobRatingDetailsDto());
        // First job rating throws, second succeeds
        _rateJobServiceMock.SetupSequence(r => r.GetJobRateUsAsync(It.IsAny<JobRatingDetailsDto>()))
            .ThrowsAsync(new InvalidOperationException("Rating service unavailable"))
            .ReturnsAsync(50m);

        var service = CreateService();
        var meetingPoint = CreateTestMeetingPointAddress();

        // Act
        await service.SplitJobAsync(1, "TestUser", meetingPoint);

        // Assert
        await using (var context = CreateContext())
        {
            var parentJob = await context.TucJobs.FindAsync(1);
            var deliveryJob = await context.TucJobs.FindAsync(SpDeliveryJobId);

            // First rate = 0 (failed), second = 50. Total = 50.
            // First: 0/50 * 100 = 0. Last job: 100 - 0 = 100.
            parentJob!.UcjbAmount.Should().Be(0m);
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

        SetupDeliveryJobMock();
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

        SetupDeliveryJobMock();
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
