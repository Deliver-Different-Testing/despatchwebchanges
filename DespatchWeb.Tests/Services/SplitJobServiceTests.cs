using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for SplitJobService — the core business logic that splits
/// a job into pickup and delivery legs with a meeting point address.
/// Uses SQLite in-memory for EF Core operations and Moq for repository/service calls.
/// </summary>
public class SplitJobServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock;
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<IRateJobService> _rateJobServiceMock = new();
    private readonly DespatchContext _seedContext;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private static readonly string[] Expected = ["JOB-500A", "JOB-500B"];

    public SplitJobServiceTests()
    {
        _seedContext = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock();

        // Default tenant info
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetContactId()).Returns(1);
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");

        SeedLookupData();
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _seedContext.DisposeAsync();
        await _db.DisposeAsync();
    }

    [Fact]
    public async Task SplitJobAsync_GeneratesLetterSuffixJobNumbers()
    {
        SeedJob(100, "JOB-500");
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // Bug #1 fix: job numbers use clean letter suffixes without speed name appended
        var jobNumbers = new[] { pickup.UcjbNumber, delivery.UcjbNumber }.OrderBy(n => n).ToList();
        Assert.Equivalent(Expected, jobNumbers);
    }

    private void SeedLookupData()
    {
        // Relationship types required by the combined lookups query
        _seedContext.TblJobRelationshipTypes.AddRange(
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = 1,
                SystemName = "SplitParent",
                Name = "Split Parent",
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test",
                ShortName = "SP"
            },
            new TblJobRelationshipType
            {
                JobRelationshipTypeId = 2,
                SystemName = "SplitChild",
                Name = "Split Child",
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        // "Unknown" suburb — fallback suburb ID for US tenants where zone-based
        // rate triggers require non-null suburb IDs on child jobs.
        _seedContext.TucSuburbs.Add(new TucSuburb
        {
            UcsuId = 1,
            UcsuName = "Unknown",
            UcsuArea = 0,
            UcsuBaseRegion = 0,
            Smsname = "Unknown",
            PostCode = "00000",
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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

    [Fact]
    public async Task SplitJobAsync_JobNotFound_ThrowsInvalidOperationException()
    {
        var service = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<(int PickupJobId, int DeliveryJobId)>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Job 999 not found", ex.Message);
        return;

        async Task<(int PickupJobId, int DeliveryJobId)> Act() => await service.SplitJobAsync(999, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);
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
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        var ex = await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<(int PickupJobId, int DeliveryJobId)>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("flights assigned", ex.Message);
        return;

        async Task<(int PickupJobId, int DeliveryJobId)> Act() => await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task SplitJobAsync_NullSpeed_SucceedsWithoutCrash()
    {
        // Bug #4 fix: null speed no longer throws ArgumentNullException.
        // UcjbSpeed is copied directly from the parent — no validation needed.
        SeedJob(configure: j => j.UcjbSpeed = null);

        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        Assert.True(pickupId > 0);
        Assert.True(deliveryId > 0);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobsCopyParentStatus()
    {
        // Bug #2 fix: child jobs copy parent status directly (no Acknowledge hardcode)
        SeedJob(configure: j => j.UcjbStatus = 7);
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(7, pickup.UcjbStatus);
        Assert.Equal(7, delivery.UcjbStatus);
    }

    [Fact]
    public async Task SplitJobAsync_ValidJob_ReturnsBothJobIds()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        Assert.True(pickupId > 0);
        Assert.True(deliveryId > 0);
        Assert.NotEqual(pickupId, deliveryId);
    }

    [Fact]
    public async Task SplitJobAsync_CreatesTwoChildJobs()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var childJobs = await verifyCtx.TucJobs.AsNoTracking()
            .Where(j => j.ParentId == 100 && j.UcjbId != 100)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, childJobs.Count);
        Assert.Contains(childJobs, j => j.UcjbId == pickupId);
        Assert.Contains(childJobs, j => j.UcjbId == deliveryId);
    }

    [Fact]
    public async Task SplitJobAsync_SetsParentJobRelationshipType()
    {
        SeedJob();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        // Verify the original job's relationship type was set to SplitParent (ID=1)
        await using var verifyCtx = new DespatchContext(_db.Options);
        var parentJob = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == 100,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(1, parentJob.JobRelationshipTypeId);
    }

    [Fact]
    public async Task SplitJobAsync_ReplacesParentJobCourier()
    {
        // Without a parent courier setting, the parent job courier becomes null
        SeedJob(configure: j => j.UcjbCourierId = 5);
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var parentJob = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == 100,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.NotEqual(5, parentJob.UcjbCourierId);
    }

    [Fact]
    public async Task SplitJobAsync_PickupJobDeliveryAddress_IsMeetingPoint()
    {
        SeedJob();
        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();

        var (pickupId, _) =
            await service.SplitJobAsync(100, "TestUser", meetingPoint, ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(meetingPoint.AddressLine1, pickup.DeliveryAddressLine1);
        Assert.Equal(meetingPoint.AddressLine5, pickup.DeliveryAddressLine5);
        Assert.Equal(meetingPoint.Latitude, pickup.DeliveryLatitude);
        Assert.Equal(meetingPoint.Longitude, pickup.DeliveryLongitude);
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

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal("1 Pickup St", pickup.PickupAddressLine1);
        Assert.Equal(-36.80m, pickup.PickUpLatitude);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobPickupAddress_IsMeetingPoint()
    {
        SeedJob();
        var meetingPoint = CreateMeetingPointAddress();
        var service = CreateService();

        var (_, deliveryId) =
            await service.SplitJobAsync(100, "TestUser", meetingPoint, ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(meetingPoint.AddressLine1, delivery.PickupAddressLine1);
        Assert.Equal(meetingPoint.AddressLine5, delivery.PickupAddressLine5);
        Assert.Equal(meetingPoint.Latitude, delivery.PickUpLatitude);
        Assert.Equal(meetingPoint.Longitude, delivery.PickUpLongitude);
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

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal("99 Delivery Ave", delivery.DeliveryAddressLine1);
        Assert.Equal(-41.28m, delivery.DeliveryLatitude);
    }

    [Fact]
    public async Task SplitJobAsync_PickupJobInheritsCourierFromOriginal()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(42, pickup.UcjbCourierId);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobHasNoCourier()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Null(delivery.UcjbCourierId);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_HaveCorrectSequenceNumbers()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(1, pickup.Sequence);
        Assert.Equal(2, delivery.Sequence);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_HaveChildRelationshipType()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // SplitChild relationship type ID = 2
        Assert.Equal(2, pickup.JobRelationshipTypeId);
        Assert.Equal(2, delivery.JobRelationshipTypeId);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_PointBackToParent()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(100, pickup.ParentId);
        Assert.Equal(100, delivery.ParentId);
        Assert.Equal(100, pickup.RootParentId);
        Assert.Equal(100, delivery.RootParentId);
    }

    [Fact]
    public async Task SplitJobAsync_ChildJobs_AreNotVoidOrDone()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.False(pickup.UcjbVoid);
        Assert.False(pickup.UcjbJobDone);
        Assert.False(delivery.UcjbVoid);
        Assert.False(delivery.UcjbJobDone);
    }

    [Fact]
    public async Task SplitJobAsync_CreatesInternalNotesForBothJobs()
    {
        SeedJob();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var notes = await verifyCtx.TucNotes.AsNoTracking()
            .Where(n => n.JobId == pickupId || n.JobId == deliveryId)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, notes.Count);
        Assert.Contains(notes, n => n.JobId == pickupId && n.NoteText.Contains("SPLIT Part 1 of 2"));
        Assert.Contains(notes, n => n.JobId == deliveryId && n.NoteText.Contains("SPLIT Part 2 of 2"));
        Assert.All(notes, n => Assert.Equal((int)NoteType.InternalNote, n.NoteTypeId));
    }

    [Fact]
    public async Task SplitJobAsync_IncludesParentNotesInChildNotes()
    {
        SeedJob(configure: j => j.UcjbNotes = "Handle with care");
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var note = await verifyCtx.TucNotes.AsNoTracking().FirstAsync(n => n.JobId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Contains("Handle with care", note.NoteText);
    }

    [Fact]
    public async Task SplitJobAsync_CourierIdForLegB_AssignedToDeliveryJob()
    {
        // Bug #3 fix: optional courier assignment to delivery leg at split time
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            courierIdForLegB: 99, ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(99, delivery.UcjbCourierId);
    }

    [Fact]
    public async Task SplitJobAsync_MeetingPointSuburb_UsesUnknownSuburbFallback()
    {
        // Zone-based rate triggers (UTL_fncFuelSurcharge_InclusiveAmount, UTL_fncJob_IsValid)
        // require non-null suburb IDs. The meeting-point side should use the "Unknown" suburb.
        SeedJob(configure: j =>
        {
            j.UcjbFrom = 10;
            j.UcjbTo = 20;
        });
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // Pickup: from = original, to = Unknown suburb (meeting point)
        Assert.Equal(10, pickup.UcjbFrom);
        Assert.Equal(1, pickup.UcjbTo); // Unknown suburb ID

        // Delivery: from = Unknown suburb (meeting point), to = original
        Assert.Equal(1, delivery.UcjbFrom); // Unknown suburb ID
        Assert.Equal(20, delivery.UcjbTo);
    }

    [Fact]
    public async Task SplitJobAsync_NoCourierForLegB_DeliveryJobHasNoCourier()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.AsNoTracking().FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Null(delivery.UcjbCourierId);
    }

}
