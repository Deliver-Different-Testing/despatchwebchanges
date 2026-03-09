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
/// Unit tests for SplitJobService — the core business logic that splits
/// a job into pickup and delivery legs with a meeting point address.
/// Uses SQLite in-memory for EF Core operations and Moq for repository/service calls.
/// </summary>
public class SplitJobServiceTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _options;
    private readonly DespatchContext _seedContext;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IRateJobService> _rateJobServiceMock = new();
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();

    private int _nextCreatedJobId = 2000;

    public SplitJobServiceTests()
    {
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

        _options = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        _seedContext = new DespatchContext(_options);
        _seedContext.Database.EnsureCreated();

        // Each call returns a new context backed by the same SQLite connection,
        // so data seeded via _seedContext is visible to the service's context.
        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_options));

        // Default tenant info
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(new DateTime(2024, 1, 15, 10, 0, 0));
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetContactId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");

        // Default CreateMinimalTucJobAsync — inserts a TucJob into the shared DB
        // so the service can load it back with FirstOrDefaultAsync.
        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CreateMinimalTucJobInputModel input, CancellationToken _) =>
            {
                var jobId = Interlocked.Increment(ref _nextCreatedJobId);
                using var ctx = new DespatchContext(_options);
                ctx.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = input.JobNumber });
                ctx.SaveChanges();
                return new CreateMinimalTucJobResponse { Success = true, JobId = jobId };
            });

        SeedLookupData();
    }

    public void Dispose()
    {
        _seedContext.Dispose();
        _connection.Dispose();
    }

    #region Helpers

    private void SeedLookupData()
    {
        // Relationship types required by the combined lookups query
        _seedContext.TblJobRelationshipTypes.AddRange(
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = 1,
                SystemName = "SplitParent",
                Name = "Split Parent",
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test",
                ShortName = "SP"
            },
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = 2,
                SystemName = "SplitChild",
                Name = "Split Child",
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test",
                ShortName = "SC"
            });

        // TucJobType required so UcjbSpeedNavigation is populated via Include (1B optimisation)
        _seedContext.TucJobTypeGroupings.Add(new TucJobTypeGrouping
        {
            GroupingId = 1,
            GroupingName = "Default",
            RatingEnabled = false
        });

        _seedContext.TucJobTypes.Add(new TucJobType
        {
            UcjtId = 1,
            UcjtName = "Standard",
            SystemName = "Standard",
            WebServiceEntry = true,
            UcjtBaseRate = 0,
            UcjtUnitRate = 0,
            GroupingId = 1,
            ShowPhotosWhenChild = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // TblSettings required as anchor for 1A combined lookups query.
        // ParentJobCourierId left null — no courier override in tests.
        _seedContext.TblSettings.Add(new TblSetting
        {
            SettingId = 1,
            InternetJobChargeType = 3,
            InternetJobStaffId = 42,
            SystemName = "Test",
            Version = "1.0",
            ApplicationName = "Test",
            AdminEmail = "test@test.com",
            ReportUserName = "test",
            ReportPassword = "test",
            ReportDomain = "test",
            DefaultDateRange = "30",
            EnquiryEmail = "test@test.com",
            Smtpserver = "localhost",
            ContactUsEmailSubject = "Test",
            NewsImageDirectory = "/img",
            StaffImageDirectory = "/img",
            CommunicationFileDirectory = "/files",
            JoinOurTeamEmail = "test@test.com",
            JoinOurTeamSubject = "Test",
            JobFeedbackSubject = "Test",
            InternetJobEmailSubject = "Test",
            InternetJobPoaemail = "test@test.com",
            InternetJobPoaemailSubject = "Test",
            ToolTipImageDirectory = "/img",
            InternetRoot = "http://test",
            InternetClientDetailsEmail = "test@test.com",
            InternetClientDetailsSubject = "Test",
            JoinOurTeamReplyFromEmail = "test@test.com",
            JoinOurTeamReplySubject = "Test",
            JoinOurTeamReplyMessage = "Test",
            JobDetailsReplyFromEmail = "test@test.com",
            TrackAndTrackReplyFromEmail = "test@test.com",
            PpdDescription = "Test",
            PpdAppliedDescription = "Test",
            UncheckDirectEmailMessage = "Test",
            UncheckDirectEmailSubject = "Test",
            UncheckDirectEmailReply = "test@test.com",
            FaxHeadLogo = [],
            FaxHeadLogoSmall = [],
            LetterHeadLogo = [],
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        _seedContext.SaveChanges();
    }

    private SplitJobService CreateService() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _rateJobServiceMock.Object,
        _jobRepositoryMock.Object);

    private static AddressViewModel CreateMeetingPointAddress() => new(
        addressLine1: "100 Meeting Point Rd",
        addressLine2: string.Empty,
        addressLine3: string.Empty,
        addressLine4: string.Empty,
        addressLine5: "Auckland",
        addressLine6: string.Empty,
        addressLine7: "1010",
        addressLine8: string.Empty)
    {
        Latitude = -36.85m,
        Longitude = 174.76m
    };

    private void SeedJob(int jobId = 100, string jobNumber = "JOB-100", Action<TucJob>? configure = null)
    {
        var job = new TucJob
        {
            UcjbId = jobId,
            UcjbNumber = jobNumber,
            UcjbSpeed = 1,
            UcjbClientId = 10,
            UcjbAmount = 50.00m,
            UcjbCourierId = 5,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            PickupAddressLine1 = "1 Pickup St",
            PickupAddressLine5 = "Auckland",
            DeliveryAddressLine1 = "99 Delivery Ave",
            DeliveryAddressLine5 = "Wellington"
        };

        configure?.Invoke(job);
        _seedContext.TucJobs.Add(job);
        _seedContext.SaveChanges();
    }

    #endregion

    #region Validation Tests

    [Fact]
    public async Task SplitJobAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        var service = CreateService();

        var act = async () => await service.SplitJobAsync(999, "TestUser", CreateMeetingPointAddress());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Job 999 not found*");
    }

    [Fact]
    public async Task SplitJobAsync_JobWithFlightAssignment_ThrowsInvalidOperationException()
    {
        SeedJob();
        _seedContext.TucJobNationwides.Add(new TucJobNationwide
        {
            UcnwJobId = 100,
            UcnwJobNumber = "JOB-100",
            UcnwClientId = 1,
            UcnwDestinationId = 1,
            UcnwItb = 0,
            UcnwPickUpJobId = 0,
            UcnwDeliveryJobId = 0,
            UcnwAirportOnly = false,
            UcnwLegNumber = 1
        });
        await _seedContext.SaveChangesAsync();

        var service = CreateService();

        var act = async () => await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*flights assigned*");
    }

    [Fact]
    public async Task SplitJobAsync_NullSpeed_ThrowsArgumentNullException()
    {
        // UcjbSpeed = null means UcjbSpeedNavigation won't be populated via Include,
        // so the 1B optimisation produces a null validSpeed → ArgumentNullException
        SeedJob(configure: j => j.UcjbSpeed = null);

        var service = CreateService();

        var act = async () => await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task SplitJobAsync_PickupCreationFails_ThrowsInvalidOperationException()
    {
        SeedJob();
        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreateMinimalTucJobResponse
            {
                Success = false,
                Message = "Stored proc error"
            });

        var service = CreateService();

        var act = async () => await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Failed to create pickup job*");
    }

    #endregion

    #region Happy Path Tests

    [Fact]
    public async Task SplitJobAsync_ValidJob_ReturnsBothJobIds()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        pickupId.Should().BeGreaterThan(0);
        deliveryId.Should().BeGreaterThan(0);
        pickupId.Should().NotBe(deliveryId);
    }

    [Fact]
    public async Task SplitJobAsync_CallsCreateMinimalTucJobAsync_Twice()
    {
        SeedJob();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        _jobRepositoryMock.Verify(
            x => x.CreateMinimalTucJobAsync(It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()),
            Times.Exactly(2));
    }

    [Fact]
    public async Task SplitJobAsync_SetsParentJobRelationshipType()
    {
        SeedJob();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        // Verify the original job's relationship type was set to SplitParent (ID=1)
        await using var verifyCtx = new DespatchContext(_options);
        var parentJob = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == 100);
        parentJob.JobRelationshipTypeId.Should().Be(1);
    }

    [Fact]
    public async Task SplitJobAsync_ReplacesParentJobCourier()
    {
        // Without a parent courier setting, the parent job courier becomes null
        SeedJob(configure: j => j.UcjbCourierId = 5);
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var parentJob = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == 100);
        parentJob.UcjbCourierId.Should().NotBe(5, "parent job courier should be replaced (original goes to pickup)");
    }

    #endregion

    #region Address Routing Tests

    [Fact]
    public async Task SplitJobAsync_PickupJobDeliveryAddress_IsMeetingPoint()
    {
        SeedJob();
        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", meetingPoint);

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);

        pickup.DeliveryAddressLine1.Should().Be(meetingPoint.AddressLine1);
        pickup.DeliveryAddressLine5.Should().Be(meetingPoint.AddressLine5);
        pickup.DeliveryLatitude.Should().Be(meetingPoint.Latitude);
        pickup.DeliveryLongitude.Should().Be(meetingPoint.Longitude);
    }

    [Fact]
    public async Task SplitJobAsync_PickupJobPickupAddress_IsOriginalPickup()
    {
        SeedJob(configure: j =>
        {
            j.PickupAddressLine1 = "1 Pickup St";
            j.PickUpLatitude = -36.80m;
        });
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);

        pickup.PickupAddressLine1.Should().Be("1 Pickup St");
        pickup.PickUpLatitude.Should().Be(-36.80m);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobPickupAddress_IsMeetingPoint()
    {
        SeedJob();
        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", meetingPoint);

        await using var verifyCtx = new DespatchContext(_options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        delivery.PickupAddressLine1.Should().Be(meetingPoint.AddressLine1);
        delivery.PickupAddressLine5.Should().Be(meetingPoint.AddressLine5);
        delivery.PickUpLatitude.Should().Be(meetingPoint.Latitude);
        delivery.PickUpLongitude.Should().Be(meetingPoint.Longitude);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobDeliveryAddress_IsOriginalDelivery()
    {
        SeedJob(configure: j =>
        {
            j.DeliveryAddressLine1 = "99 Delivery Ave";
            j.DeliveryLatitude = -41.28m;
        });
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        delivery.DeliveryAddressLine1.Should().Be("99 Delivery Ave");
        delivery.DeliveryLatitude.Should().Be(-41.28m);
    }

    #endregion

    #region Courier Assignment Tests

    [Fact]
    public async Task SplitJobAsync_PickupJobInheritsCourierFromOriginal()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);

        pickup.UcjbCourierId.Should().Be(42, "pickup leg keeps the original courier");
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobHasNoCourier()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        delivery.UcjbCourierId.Should().BeNull("delivery leg starts unassigned");
    }

    #endregion

    #region Child Job Field Tests

    [Fact]
    public async Task SplitJobAsync_ChildJobs_HaveCorrectSequenceNumbers()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        pickup.Sequence.Should().Be(1);
        delivery.Sequence.Should().Be(2);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_HaveChildRelationshipType()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        // SplitChild relationship type ID = 2
        pickup.JobRelationshipTypeId.Should().Be(2);
        delivery.JobRelationshipTypeId.Should().Be(2);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_PointBackToParent()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        pickup.ParentId.Should().Be(100);
        delivery.ParentId.Should().Be(100);
        pickup.RootParentId.Should().Be(100);
        delivery.RootParentId.Should().Be(100);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_AreNotVoidOrDone()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId);

        pickup.UcjbVoid.Should().BeFalse();
        pickup.UcjbJobDone.Should().BeFalse();
        delivery.UcjbVoid.Should().BeFalse();
        delivery.UcjbJobDone.Should().BeFalse();
    }

    #endregion

    #region Notes Tests

    [Fact]
    public async Task SplitJobAsync_CreatesInternalNotesForBothJobs()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var notes = await verifyCtx.TucNotes.AsNoTracking()
            .Where(n => n.JobId == pickupId || n.JobId == deliveryId)
            .ToListAsync();

        notes.Should().HaveCount(2);
        notes.Should().Contain(n => n.JobId == pickupId && n.NoteText.Contains("SPLIT Part 1 of 2"));
        notes.Should().Contain(n => n.JobId == deliveryId && n.NoteText.Contains("SPLIT Part 2 of 2"));
        notes.Should().OnlyContain(n => n.NoteTypeId == (int)NoteType.InternalNote);
    }

    [Fact]
    public async Task SplitJobAsync_IncludesParentNotesInChildNotes()
    {
        SeedJob(configure: j => j.UcjbNotes = "Handle with care");
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        await using var verifyCtx = new DespatchContext(_options);
        var note = await verifyCtx.TucNotes.AsNoTracking().FirstAsync(n => n.JobId == pickupId);

        note.NoteText.Should().Contain("Handle with care");
    }

    #endregion

    #region Job Number Generation Tests

    [Fact]
    public async Task SplitJobAsync_GeneratesLetterSuffixJobNumbers()
    {
        SeedJob(100, "JOB-500");
        CreateMinimalTucJobInputModel? firstInput = null;
        CreateMinimalTucJobInputModel? secondInput = null;
        var callCount = 0;

        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CreateMinimalTucJobInputModel input, CancellationToken _) =>
            {
                var current = Interlocked.Increment(ref callCount);
                if (current == 1) firstInput = input;
                else secondInput = input;

                var jobId = Interlocked.Increment(ref _nextCreatedJobId);
                using var ctx = new DespatchContext(_options);
                ctx.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = input.JobNumber });
                ctx.SaveChanges();
                return new CreateMinimalTucJobResponse { Success = true, JobId = jobId };
            });

        var service = CreateService();
        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress());

        // First split: no existing children → suffixes A and B
        firstInput!.JobNumber.Should().Be("JOB-500A");
        secondInput!.JobNumber.Should().Be("JOB-500B");
    }

    #endregion

    #region Input Model Tests

    [Fact]
    public async Task SplitJobAsync_PickupInputUsesOriginalPickupAsFrom()
    {
        SeedJob(configure: j =>
        {
            j.PickupAddressLine1 = "1 Origin St";
            j.PickUpLatitude = -36.80m;
            j.PickUpLongitude = 174.70m;
        });

        CreateMinimalTucJobInputModel? pickupInput = null;
        var callCount = 0;

        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CreateMinimalTucJobInputModel input, CancellationToken _) =>
            {
                if (Interlocked.Increment(ref callCount) == 1) pickupInput = input;

                var jobId = Interlocked.Increment(ref _nextCreatedJobId);
                using var ctx = new DespatchContext(_options);
                ctx.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = input.JobNumber });
                ctx.SaveChanges();
                return new CreateMinimalTucJobResponse { Success = true, JobId = jobId };
            });

        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();
        await service.SplitJobAsync(100, "TestUser", meetingPoint);

        // Pickup: From = original pickup, To = meeting point
        pickupInput!.FromAddress.AddressLine1.Should().Be("1 Origin St");
        pickupInput.ToAddress.AddressLine1.Should().Be(meetingPoint.AddressLine1);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryInputUsesMeetingPointAsFrom()
    {
        SeedJob(configure: j =>
        {
            j.DeliveryAddressLine1 = "99 Destination Ave";
            j.DeliveryLatitude = -41.28m;
            j.DeliveryLongitude = 174.77m;
        });

        CreateMinimalTucJobInputModel? deliveryInput = null;
        var callCount = 0;

        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync((CreateMinimalTucJobInputModel input, CancellationToken _) =>
            {
                if (Interlocked.Increment(ref callCount) == 2) deliveryInput = input;

                var jobId = Interlocked.Increment(ref _nextCreatedJobId);
                using var ctx = new DespatchContext(_options);
                ctx.TucJobs.Add(new TucJob { UcjbId = jobId, UcjbNumber = input.JobNumber });
                ctx.SaveChanges();
                return new CreateMinimalTucJobResponse { Success = true, JobId = jobId };
            });

        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();
        await service.SplitJobAsync(100, "TestUser", meetingPoint);

        // Delivery: From = meeting point, To = original delivery
        deliveryInput!.FromAddress.AddressLine1.Should().Be(meetingPoint.AddressLine1);
        deliveryInput.ToAddress.AddressLine1.Should().Be("99 Destination Ave");
    }

    #endregion
}
