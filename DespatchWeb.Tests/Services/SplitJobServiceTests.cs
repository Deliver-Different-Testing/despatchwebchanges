using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for SplitJobService — the core business logic that splits
/// a job into pickup and delivery legs with a meeting point address.
/// Uses SQLite in-memory for EF Core operations and Moq for repository/service calls.
/// </summary>
public class SplitJobServiceTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly IJobQueryRepository _jobRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly IRateJobService _rateJobServiceMock = Substitute.For<IRateJobService>();
    private readonly DespatchContext _seedContext;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly ITenantClock _fakeTenantClock = new FakeTenantClock(TestDates.Now);
    private static readonly string[] Expected = ["JOB-500A", "JOB-500B"];

    public SplitJobServiceTests()
    {
        _seedContext = _db.CreateContext();
        _contextFactoryMock = _db.CreateFactoryMock();

        // Default tenant info
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetContactId().Returns(1);
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");

        // Rating defaults — return rate=0 for every child unless a test overrides per-child.
        // Re-rate falls back to an even split when totalRate == 0, so the parent amount is
        // still preserved exactly across children.
        _rateJobServiceMock.GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>())
            .Returns(new ApiRerate { Rate = 0m });
        _rateJobServiceMock.GetJobRateUsAsync(Arg.Any<JobRatingDetailsDto>())
            .Returns(new ApiRerate { Rate = 0m });
        _jobRepositoryMock.GetJobDetailsForRatingNzAsync(Arg.Any<int>(), Arg.Any<bool>())
            .Returns(new JobRatingDetailsDtoNz());
        _jobRepositoryMock.GetJobDetailsForRatingAsync(Arg.Any<int>())
            .Returns(new JobRatingDetailsDto());

        // Split re-rate reads details on the transaction's own connection (the context
        // overloads) so the read joins the open transaction instead of self-blocking.
        _jobRepositoryMock
            .GetJobDetailsForRatingNzAsync(Arg.Any<DespatchContext>(), Arg.Any<int>(), Arg.Any<bool>())
            .Returns(new JobRatingDetailsDtoNz());
        _jobRepositoryMock
            .GetJobDetailsForRatingAsync(Arg.Any<DespatchContext>(), Arg.Any<int>())
            .Returns(new JobRatingDetailsDto());

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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _fakeTenantClock,
        _rateJobServiceMock,
        _jobRepositoryMock,
        _jobCommandRepositoryMock,
        new CreateJobService(_contextFactoryMock));

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

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            (Func<Task<(int PickupJobId, int DeliveryJobId)>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Job 999 not found", ex.Message);
        return;

        async Task<(int PickupJobId, int DeliveryJobId)> Act() => await service.SplitJobAsync(999, "TestUser",
            CreateMeetingPointAddress(),
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

        var ex = await Assert.ThrowsAsync<InvalidOperationException>(
            (Func<Task<(int PickupJobId, int DeliveryJobId)>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("flights assigned", ex.Message);
        return;

        async Task<(int PickupJobId, int DeliveryJobId)> Act() => await service.SplitJobAsync(100, "TestUser",
            CreateMeetingPointAddress(),
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var childJobs = await verifyCtx.TucJobs
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
        var parentJob = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 100,
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
        var parentJob = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 100,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
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
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
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
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var notes = await verifyCtx.TucNotes
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
        var note = await verifyCtx.TucNotes.FirstAsync(n => n.JobId == pickupId,
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
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
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
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // Pickup: from = original, to = Unknown suburb (meeting point)
        Assert.Equal(10, pickup.UcjbFrom);
        Assert.Equal(1, pickup.UcjbTo); // Unknown suburb ID

        // Delivery: from = Unknown suburb (meeting point), to = original
        Assert.Equal(1, delivery.UcjbFrom); // Unknown suburb ID
        Assert.Equal(20, delivery.UcjbTo);
    }

    [Fact]
    public async Task SplitJobAsync_DispatchFieldsCopiedToChildJobs_WhenCourierAssigned()
    {
        // Fix: dispatch fields must be copied so tucJob_Insert_ClearListAreaOrder trigger
        // doesn't fail with NULL OrderTime on tblClearListAreaOrder insert.
        var dispTime = new DateTime(2024, 1, 15, 10, 30, 0);
        var dispDate = new DateTime(2024, 1, 15);
        SeedJob(configure: j =>
        {
            j.UcjbCourierId = 42;
            j.UcjbDispTime = dispTime;
            j.UcjbDispDate = dispDate;
            j.UcjbDispId = 7;
        });
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            courierIdForLegB: 99, ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // Pickup leg always gets dispatch fields (courier is always assigned)
        Assert.Equal(TestDates.Now, pickup.UcjbDispTime);
        Assert.Equal(TestDates.Now, pickup.UcjbDispDate);
        Assert.Equal(7, pickup.UcjbDispId);

        // Delivery leg gets dispatch fields when courierIdForLegB is provided
        Assert.Equal(TestDates.Now, delivery.UcjbDispTime);
        Assert.Equal(TestDates.Now, delivery.UcjbDispDate);
        Assert.Equal(7, delivery.UcjbDispId);
    }

    [Fact]
    public async Task SplitJobAsync_DeliveryJobNoCourier_DispatchFieldsNotCopied()
    {
        var dispTime = new DateTime(2024, 1, 15, 10, 30, 0);
        var dispDate = new DateTime(2024, 1, 15);
        SeedJob(configure: j =>
        {
            j.UcjbCourierId = 42;
            j.UcjbDispTime = dispTime;
            j.UcjbDispDate = dispDate;
            j.UcjbDispId = 7;
        });
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // No courier for leg B → dispatch fields should NOT be copied
        Assert.Null(delivery.UcjbDispTime);
        Assert.Null(delivery.UcjbDispDate);
        Assert.Null(delivery.UcjbDispId);
    }

    [Fact]
    public async Task SplitJobAsync_NoCourierForLegB_DeliveryJobHasNoCourier()
    {
        SeedJob(configure: j => j.UcjbCourierId = 42);
        var service = CreateService();

        var (_, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Null(delivery.UcjbCourierId);
    }

    [Fact]
    public async Task SplitJobAsync_DistributesParentAmountAcrossChildren_ProportionalToLegRates()
    {
        // The original bug: child legs were initialised at parent.UcjbAmount and re-rate
        // was best-effort, so a silent re-rate failure billed the client 2x. Now we expect
        // the parent amount to be exactly redistributed across the legs in proportion to
        // each leg's calculated rate — verified here with explicit per-leg rate mocks.
        SeedJob(configure: j => j.UcjbAmount = 100.00m);

        // Pickup leg (Sequence=1) returns rate $30; delivery leg (Sequence=2) returns rate $70.
        // Match by FromId so the mock keys off which leg we're rating:
        //   pickup leg: UcjbFrom = job.UcjbFrom (default null)
        //   delivery leg: UcjbFrom = 1 (Unknown suburb, the meeting point)
        _jobRepositoryMock
            .GetJobDetailsForRatingNzAsync(Arg.Any<DespatchContext>(), Arg.Any<int>(), Arg.Any<bool>())
            .Returns(callInfo =>
            {
                var jobId = callInfo.Arg<int>();
                using var ctx = new DespatchContext(_db.Options);
                var job = ctx.TucJobs.First(j => j.UcjbId == jobId);
                return new JobRatingDetailsDtoNz { JobId = jobId, FromId = job.UcjbFrom };
            });
        _rateJobServiceMock
            .GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>())
            .Returns(callInfo =>
            {
                var dto = callInfo.Arg<JobRatingDetailsDtoNz>();
                return new ApiRerate { Rate = dto.FromId == 1 ? 70m : 30m };
            });

        var service = CreateService();
        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(30.00m, pickup.UcjbAmount);
        Assert.Equal(70.00m, delivery.UcjbAmount);
        // The invariant: child total must equal parent total exactly — no double-charging.
        Assert.Equal(100.00m, (pickup.UcjbAmount ?? 0m) + (delivery.UcjbAmount ?? 0m));
    }

    [Fact]
    public async Task SplitJobAsync_AllRatesZero_FallsBackToEvenSplit()
    {
        // If every leg's rate comes back as zero (e.g. DFRNT returns 0 legitimately or the
        // mock isn't configured) we still preserve the parent total by splitting evenly.
        // This is the safety net behind the bigger invariant: child total == parent total.
        SeedJob(configure: j => j.UcjbAmount = 100.00m);

        var service = CreateService();
        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(50.00m, pickup.UcjbAmount);
        Assert.Equal(50.00m, delivery.UcjbAmount);
        Assert.Equal(100.00m, (pickup.UcjbAmount ?? 0m) + (delivery.UcjbAmount ?? 0m));
    }

    [Fact]
    public async Task SplitJobAsync_Nz_ReRatesChildrenOnTheTransactionConnection()
    {
        // Regression guard for the split-jobs timeout (SQL error 258): the re-rate must read
        // each freshly-inserted child on the split transaction's own connection — via the
        // context overload — not on the repository's separate connection, which would block on
        // the transaction's locks. The real lock-timeout isn't reproducible under SQLite, so we
        // pin the invariant that establishes the fix.
        SeedJob();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        // Both children re-rated via the transaction-context overload...
        await _jobRepositoryMock.Received(2)
            .GetJobDetailsForRatingNzAsync(Arg.Any<DespatchContext>(), Arg.Any<int>(), Arg.Any<bool>());
        // ...and never via the connection-less overload during the split.
        await _jobRepositoryMock.DidNotReceive()
            .GetJobDetailsForRatingNzAsync(Arg.Any<int>(), Arg.Any<bool>());
    }

    [Fact]
    public async Task SplitJobAsync_Us_ReRatesChildrenOnTheTransactionConnection()
    {
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        SeedJob();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await _jobRepositoryMock.Received(2)
            .GetJobDetailsForRatingAsync(Arg.Any<DespatchContext>(), Arg.Any<int>());
        await _jobRepositoryMock.DidNotReceive().GetJobDetailsForRatingAsync(Arg.Any<int>());
    }

    [Fact]
    public async Task SplitJobAsync_RateServiceThrows_RollsBackTheSplit()
    {
        // The whole point of pulling re-rate inside the transaction: if rating fails, the
        // split must roll back rather than leave the children persisted at $0 (visible) or
        // — worse — at parent.UcjbAmount (silent over-billing).
        SeedJob(configure: j => j.UcjbAmount = 100.00m);
        _rateJobServiceMock
            .GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>())
            .ThrowsAsync(new InvalidOperationException("DFRNT API unavailable"));

        var service = CreateService();

        await Assert.ThrowsAsync<InvalidOperationException>(async () =>
            await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
                ct: TestContext.Current.CancellationToken));

        await using var verifyCtx = new DespatchContext(_db.Options);
        // No children persisted — the transaction rolled back.
        var childCount = await verifyCtx.TucJobs
            .CountAsync(j => j.ParentId == 100 && j.UcjbId != 100,
                TestContext.Current.CancellationToken);
        Assert.Equal(0, childCount);

        // Parent untouched — relationship type still null, amount preserved.
        var parent = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 100,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(100.00m, parent.UcjbAmount);
        Assert.Null(parent.JobRelationshipTypeId);
    }

    [Fact]
    public async Task SplitJobAsync_ReSplit_OnlyRedistributesTheLegBeingSplit_SiblingUntouched()
    {
        // The original bug's x3 case: re-splitting a leg redistributed the leg's amount
        // across ALL descendants of the root parent, silently overwriting the sibling
        // from the first split. The fixed scope is the IMMEDIATE children of the parent
        // being split, so the unrelated sibling keeps its post-first-split amount.
        SeedJob(configure: j => j.UcjbAmount = 100.00m);

        var service = CreateService();

        // First split — pickup + delivery, each at $50 via even-split fallback.
        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        // Re-split the delivery leg.
        var (subPickupId, subDeliveryId) = await service.SplitJobAsync(deliveryId, "TestUser",
            CreateMeetingPointAddress(), ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);
        var subPickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == subPickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var subDelivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == subDeliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // Unrelated sibling — set by the first split — must not be touched by the re-split.
        Assert.Equal(50.00m, pickup.UcjbAmount);

        // The delivery leg's $50 is split evenly between its two new sub-children.
        Assert.Equal(25.00m, subPickup.UcjbAmount);
        Assert.Equal(25.00m, subDelivery.UcjbAmount);

        // Tree total still equals the original parent amount (no double/triple-charging).
        // delivery is now a SplitParent and its UcjbAmount stays as-is at the parent level;
        // its leaf children are subPickup + subDelivery, summing to delivery's $50.
        Assert.Equal(delivery.UcjbAmount, (subPickup.UcjbAmount ?? 0m) + (subDelivery.UcjbAmount ?? 0m));
        Assert.Equal(100.00m,
            (pickup.UcjbAmount ?? 0m) + (subPickup.UcjbAmount ?? 0m) + (subDelivery.UcjbAmount ?? 0m));
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_CallsUpdateForEachNonVoidChild()
    {
        // Bug guard: when a parent split job's Van flag is toggled, the propagation must
        // dispatch the same UpdateJobAsync(JobProperty.Van) call to every non-void child
        // so the children re-rate as vans too. Skips the void child.
        SeedJob(jobId: 100, jobNumber: "JOB-100", configure: j =>
        {
            j.JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent;
            j.RootParentId = 100;
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 101,
            UcjbNumber = "JOB-100A",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 1
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 102,
            UcjbNumber = "JOB-100B",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 2
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 103,
            UcjbNumber = "JOB-100C",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 3,
            UcjbVoid = true
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.Received(1).UpdateJobAsync(101, JobProperty.Van, "true");
        await _jobCommandRepositoryMock.Received(1).UpdateJobAsync(102, JobProperty.Van, "true");
        await _jobCommandRepositoryMock.DidNotReceive().UpdateJobAsync(103, JobProperty.Van, Arg.Any<string>());
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_ManualLegKeepsAmountAndFlagAutoLegTakesRemainder()
    {
        // A manually-priced leg (custom breakdown/reprice) must survive an unrelated field
        // edit on the split parent: its amount and RatedManually flag stay untouched, and only
        // the remaining (parent total minus manual legs) is redistributed across auto legs.
        SeedJob(jobId: 100, jobNumber: "JOB-100", configure: j =>
        {
            j.JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent;
            j.RootParentId = 100;
            j.UcjbAmount = 100.00m;
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 101,
            UcjbNumber = "JOB-100A",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 1,
            RatedManually = true,
            UcjbAmount = 40.00m
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 102,
            UcjbNumber = "JOB-100B",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 2,
            UcjbAmount = 999.00m
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        // Field edit still propagates to every non-void child, manual or not.
        await _jobCommandRepositoryMock.Received(1).UpdateJobAsync(101, JobProperty.Van, "true");
        await _jobCommandRepositoryMock.Received(1).UpdateJobAsync(102, JobProperty.Van, "true");

        await using var verifyCtx = new DespatchContext(_db.Options);
        var manualLeg = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);
        var autoLeg = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 102,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(40.00m, manualLeg.UcjbAmount);
        Assert.True(manualLeg.RatedManually);

        Assert.Equal(60.00m, autoLeg.UcjbAmount);
        Assert.False(autoLeg.RatedManually);
    }

    // ── Propagating a rate change onto already-split legs ──────────────────────────────────
    //
    // Redistributing a leg's amount without touching its breakdown rows left the header and the
    // lines disagreeing, stranded FuelSurchargeAmount/CourierPayment, and let the next breakdown
    // edit revert the header to the stale line sum (RecalculateJobAmountFromBreakdownAsync).

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_RescalesEachLegsLinesToItsNewAmount()
    {
        SeedSplitLegsWithPricingLines();
        // The edit re-priced the parent from 89.00 to 100.00.
        await _seedContext.TucJobs.Where(j => j.UcjbId == 100)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.UcjbAmount, 100.00m),
                TestContext.Current.CancellationToken);

        await CreateService().PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        decimal Amount(string chargeName) => lines.Single(l => l.ChargeName == chargeName).ChargeAmount;

        // The legs keep their 61/28 division of the new total, and each leg's lines keep their
        // proportions within it.
        Assert.Equal(46.74m, Amount("Base Part A"));
        Assert.Equal(11.69m, Amount("Base Fuel Part A"));
        Assert.Equal(10.11m, Amount("Congestion Part A"));
        Assert.Equal(25.17m, Amount("Base Part B"));
        Assert.Equal(6.29m, Amount("Base Fuel Part B"));

        // The pinned charge stays wholly on leg A rather than drifting back onto leg B.
        Assert.Equal(0.00m, Amount("Congestion Part B"));

        // Each leg's lines total its header, and the legs still total the parent.
        Assert.Equal(68.54m, lines.Where(l => l.ChildJobId == 101).Sum(l => l.ChargeAmount));
        Assert.Equal(31.46m, lines.Where(l => l.ChildJobId == 102).Sum(l => l.ChargeAmount));
        Assert.Equal(100.00m, lines.Sum(l => l.ChargeAmount));
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_RewritesEachLegsHeaderFromItsOwnLines()
    {
        SeedSplitLegsWithPricingLines();
        await _seedContext.TucJobs.Where(j => j.UcjbId == 100)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.UcjbAmount, 100.00m),
                TestContext.Current.CancellationToken);

        await CreateService().PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var legA = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);
        var legB = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 102,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(68.54m, legA.UcjbAmount);
        Assert.Equal(31.46m, legB.UcjbAmount);

        // Client fuel follows the rescaled fuel line, not the pre-edit figure.
        Assert.Equal(11.69m, legA.FuelSurchargeAmount);
        Assert.Equal(6.29m, legB.FuelSurchargeAmount);

        // Driver pay is recomputed, but from cost amounts this path has no basis to change.
        Assert.Equal(34.60m, legA.CourierPayment);
        Assert.Equal(15.40m, legB.CourierPayment);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);
        Assert.Equal(50.00m, lines.Sum(l => l.CostAmount ?? 0m));

        // Re-pricing a leg doesn't change how far it travels.
        Assert.Equal(9m, legA.TotalDistance);
        Assert.Equal(1m, legB.TotalDistance);
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_KeepsTheDivision_WithoutConsultingTheRatingEngine()
    {
        // The division was settled when the job was split — re-deriving it from fresh leg rates
        // would quietly undo the shares, and any per-line override, the user confirmed there.
        SeedSplitLegsWithPricingLines();

        await CreateService().PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await _rateJobServiceMock.DidNotReceive().GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
        await _rateJobServiceMock.DidNotReceive().GetJobRateUsAsync(Arg.Any<JobRatingDetailsDto>());

        // Unchanged parent total leaves every leg exactly where it was.
        await using var verifyCtx = new DespatchContext(_db.Options);
        var legA = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);
        Assert.Equal(61.00m, legA.UcjbAmount);
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_LeavesAManualLegsLinesAlone()
    {
        SeedSplitLegsWithPricingLines();
        await _seedContext.TucJobs.Where(j => j.UcjbId == 101)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.RatedManually, true),
                TestContext.Current.CancellationToken);
        await _seedContext.TucJobs.Where(j => j.UcjbId == 100)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.UcjbAmount, 100.00m),
                TestContext.Current.CancellationToken);

        await CreateService().PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);
        var manualLeg = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);

        // The hand-set leg keeps its amount, its flag and its lines.
        Assert.Equal(61.00m, manualLeg.UcjbAmount);
        Assert.True(manualLeg.RatedManually);
        Assert.Equal(61.00m, lines.Where(l => l.ChildJobId == 101).Sum(l => l.ChargeAmount));

        // Only the remaining 39.00 goes to the auto leg, and its lines follow.
        Assert.Equal(39.00m, lines.Where(l => l.ChildJobId == 102).Sum(l => l.ChargeAmount));
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_LegacySplitWithNoLines_WritesTheHeaderOnly()
    {
        // Splits made before the legs carried their own lines have nothing to rescale — the
        // header still has to move, but the parent's unattributed rows are left as they are.
        SeedSplitLegsWithPricingLines();
        await _seedContext.PricingBreakdowns
            .ExecuteUpdateAsync(p => p.SetProperty(x => x.ChildJobId, (int?)null),
                TestContext.Current.CancellationToken);
        await _seedContext.TucJobs.Where(j => j.UcjbId == 100)
            .ExecuteUpdateAsync(j => j.SetProperty(x => x.UcjbAmount, 100.00m),
                TestContext.Current.CancellationToken);

        await CreateService().PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var legA = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(68.54m, legA.UcjbAmount);
        Assert.Equal(89.00m, lines.Sum(l => l.ChargeAmount));
        Assert.All(lines, l => Assert.Null(l.ChildJobId));
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SplitParent_AllLegsManual_SkipsReRateEntirely()
    {
        // If every leg has been manually priced there's nothing left to redistribute —
        // the re-rate must no-op rather than touch any leg's amount or call the rating engine.
        SeedJob(jobId: 100, jobNumber: "JOB-100", configure: j =>
        {
            j.JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent;
            j.RootParentId = 100;
            j.UcjbAmount = 100.00m;
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 101,
            UcjbNumber = "JOB-100A",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 1,
            RatedManually = true,
            UcjbAmount = 40.00m
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 102,
            UcjbNumber = "JOB-100B",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 2,
            RatedManually = true,
            UcjbAmount = 60.00m
        });
        await _seedContext.SaveChangesAsync(TestContext.Current.CancellationToken);

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        // No leg left to rate a preview for once manual legs are excluded.
        await _rateJobServiceMock.DidNotReceive().GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
        await _rateJobServiceMock.DidNotReceive().GetJobRateUsAsync(Arg.Any<JobRatingDetailsDto>());

        await using var verifyCtx = new DespatchContext(_db.Options);
        var leg101 = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 101,
            cancellationToken: TestContext.Current.CancellationToken);
        var leg102 = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == 102,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(40.00m, leg101.UcjbAmount);
        Assert.Equal(60.00m, leg102.UcjbAmount);
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_SingleJob_DoesNotPropagate()
    {
        // A standalone job (no Split/Multi relationship type) must never fan out updates or
        // re-rate anything — the per-job reprice is handled by the frontend modal instead.
        SeedJob(jobId: 200, jobNumber: "JOB-200");

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(200, JobProperty.Van, "true",
            TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.DidNotReceive()
            .UpdateJobAsync(Arg.Any<int>(), Arg.Any<JobProperty>(), Arg.Any<string>());
        await _rateJobServiceMock.DidNotReceive().RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
        await _rateJobServiceMock.DidNotReceive().RateJobUsAsync(Arg.Any<JobRatingDetailsDto>());
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_Multi_ReRatesParentAndEachNonVoidPart()
    {
        // Bug fix: a multi-drop parent's vehicle change must re-rate the parent AND every
        // non-void part independently (each part is priced on its own), so the total moves
        // with the new vehicle. The void part is skipped. NZ tenant -> NZ rating path.
        SeedMultiPartJob();

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Size, "3",
            TestContext.Current.CancellationToken);

        // Parent (100) + two live children (101, 102) re-rated; void child (103) skipped.
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingNzAsync(100, Arg.Any<bool>());
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingNzAsync(101, Arg.Any<bool>());
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingNzAsync(102, Arg.Any<bool>());
        await _jobRepositoryMock.DidNotReceive().GetJobDetailsForRatingNzAsync(103, Arg.Any<bool>());
        await _rateJobServiceMock.Received(3).RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>());

        // Multi parts are priced independently, NOT redistributed via the split path.
        await _jobCommandRepositoryMock.DidNotReceive()
            .UpdateJobAsync(Arg.Any<int>(), Arg.Any<JobProperty>(), Arg.Any<string>());
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_Multi_SkipsManuallyRatedPart()
    {
        // Manual price overrides must survive a vehicle change: a RatedManually part is left
        // untouched while the rest re-rate.
        SeedMultiPartJob(configureChild101: j => j.RatedManually = true);

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Size, "3",
            TestContext.Current.CancellationToken);

        await _jobRepositoryMock.DidNotReceive().GetJobDetailsForRatingNzAsync(101, Arg.Any<bool>());
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingNzAsync(100, Arg.Any<bool>());
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingNzAsync(102, Arg.Any<bool>());
        await _rateJobServiceMock.Received(2).RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
    }

    [Fact]
    public async Task PropagateUpdateToChildrenAsync_Multi_UsTenant_UsesUsRatingPath()
    {
        // US tenants rate via the distance/stored-proc path, not the NZ DFRNT path.
        _tenantInfoServiceMock.IsUsTenant().Returns(true);
        SeedMultiPartJob();

        var service = CreateService();

        await service.PropagateUpdateToChildrenAsync(100, JobProperty.Size, "3",
            TestContext.Current.CancellationToken);

        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingAsync(100);
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingAsync(101);
        await _jobRepositoryMock.Received(1).GetJobDetailsForRatingAsync(102);
        await _rateJobServiceMock.Received(3).RateJobUsAsync(Arg.Any<JobRatingDetailsDto>());
        await _rateJobServiceMock.DidNotReceive().RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
    }

    /// <summary>
    /// Seeds a Multi (multi-drop) parent job (100) with two live children (101, 102) and one
    /// void child (103). <paramref name="configureChild101"/> lets a test tweak child 101.
    /// </summary>
    private void SeedMultiPartJob(Action<TucJob>? configureChild101 = null)
    {
        SeedJob(jobId: 100, jobNumber: "JOB-100", configure: j =>
        {
            j.JobRelationshipTypeId = (int)JobRelationshipTypes.Multi;
            j.RootParentId = 100;
        });

        var child101 = new TucJob
        {
            UcjbId = 101,
            UcjbNumber = "JOB-100A",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 1
        };
        configureChild101?.Invoke(child101);
        _seedContext.TucJobs.Add(child101);

        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 102,
            UcjbNumber = "JOB-100B",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 2
        });
        _seedContext.TucJobs.Add(new TucJob
        {
            UcjbId = 103,
            UcjbNumber = "JOB-100C",
            UcjbSpeed = 1,
            UcjbStatus = 3,
            UcjbDate = new DateTime(2024, 1, 15),
            ParentId = 100,
            RootParentId = 100,
            Sequence = 3,
            UcjbVoid = true
        });
        _seedContext.SaveChanges();
    }

    // ── Per-leg pricing lines (KT1314V) ────────────────────────────────────────────────────────
    //
    // Before this, the split wrote only a flat half of the parent total to each leg's header and
    // created no breakdown lines at all, so the Price Breakdown modal fell back to the parent's
    // lines and both parts reported the parent's full revenue and cost.

    [Fact]
    public async Task SplitJobAsync_CreatesPerLegLines_AttributedToEachLeg()
    {
        SeedJob(configure: j => j.UcjbAmount = 89.00m);
        SeedParentPricingLines();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        // Every line now exists per part — "Base Part A", "Base Part B", "Congestion Part A/B" —
        // rather than the parent's three lines being re-read by both legs.
        Assert.Equal(6, lines.Count);
        Assert.All(lines, l => Assert.Equal(100, l.JobId));
        Assert.Equal(
            new[] { "Base Fuel Part A", "Base Part A", "Congestion Part A" },
            lines.Where(l => l.ChildJobId == pickupId).Select(l => l.ChargeName).Order());
        Assert.Equal(
            new[] { "Base Fuel Part B", "Base Part B", "Congestion Part B" },
            lines.Where(l => l.ChildJobId == deliveryId).Select(l => l.ChargeName).Order());

        // No unattributed rows survive — otherwise the parent total would double.
        Assert.DoesNotContain(lines, l => l.ChildJobId == null);
    }

    [Fact]
    public async Task SplitJobAsync_LeavesTheParentLineTotalUnchanged_SoTheInvoiceIsUnaffected()
    {
        SeedJob(configure: j => j.UcjbAmount = 89.00m);
        SeedParentPricingLines();
        var service = CreateService();

        await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns
            .Where(p => p.JobId == 100)
            .ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(89.00m, lines.Sum(l => l.ChargeAmount));
        Assert.Equal(50.00m, lines.Sum(l => l.CostAmount ?? 0m));
    }

    [Fact]
    public async Task SplitJobAsync_SetsEachLegsHeaderFromItsOwnLines()
    {
        SeedJob(configure: j => j.UcjbAmount = 89.00m);
        SeedParentPricingLines();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        foreach (var (leg, legId) in new[] { (pickup, pickupId), (delivery, deliveryId) })
        {
            var legLines = lines.Where(l => l.ChildJobId == legId).ToList();

            // The tile and the modal now agree: the header is the sum of the leg's own lines.
            Assert.Equal(legLines.Sum(l => l.ChargeAmount), leg.UcjbAmount);
            // Driver pay is attributed per leg instead of all sitting on the parent.
            Assert.Equal(legLines.Sum(l => l.CostAmount ?? 0m), leg.CourierPayment);
            // Fuel no longer vanishes at part level.
            Assert.Equal(
                legLines.Where(l => l.ChargeName!.Contains("Fuel")).Sum(l => l.ChargeAmount),
                leg.FuelSurchargeAmount);
            Assert.True(leg.FuelSurchargeAmount > 0m);
        }

        Assert.Equal(89.00m, (pickup.UcjbAmount ?? 0m) + (delivery.UcjbAmount ?? 0m));
        Assert.Equal(50.00m, (pickup.CourierPayment ?? 0m) + (delivery.CourierPayment ?? 0m));
    }

    [Fact]
    public async Task SplitJobAsync_DividesByRoadMiles_AndRecordsPerLegDistance()
    {
        // "If you drive 90% of the trip, you get 90% of the total." The itemised lines are the
        // total that gets divided — 89.00 here, matching the KT1314V parent.
        SeedJob(configure: j =>
        {
            j.UcjbAmount = 89.00m;
            j.PickUpLatitude = -37.00m;
            j.PickUpLongitude = 174.76m;
            j.DeliveryLatitude = -36.80m;
            j.DeliveryLongitude = 174.76m;
        });
        SeedParentPricingLines();

        // Leg A (from the job's pickup) covers 9 miles; leg B (from the meeting point) covers 1.
        _rateJobServiceMock
            .GetRoadDistanceMilesAsync(Arg.Any<decimal?>(), Arg.Any<decimal?>(), Arg.Any<decimal?>(),
                Arg.Any<decimal?>())
            .Returns(call => call.ArgAt<decimal?>(0) == -37.00m ? 9d : 1d);

        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // 90% / 10% of the 89.00 line total.
        Assert.Equal(80.10m, pickup.UcjbAmount);
        Assert.Equal(8.90m, delivery.UcjbAmount);
        Assert.Equal(89.00m, (pickup.UcjbAmount ?? 0m) + (delivery.UcjbAmount ?? 0m));

        // Per-leg miles are captured, where previously both parts recorded 0.
        Assert.Equal(9m, pickup.TotalDistance);
        Assert.Equal(1m, delivery.TotalDistance);

        // Mileage is the primary basis — the rating engine isn't consulted at all.
        await _rateJobServiceMock.DidNotReceive().GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
    }

    [Fact]
    public async Task SplitJobAsync_FallsBackToStraightLineMiles_WhenNoRoadDistanceIsAvailable()
    {
        // Leg A spans 0.15 degrees of latitude, leg B 0.05 — roughly a 3:1 split.
        SeedJob(configure: j =>
        {
            j.UcjbAmount = 100.00m;
            j.PickUpLatitude = -37.00m;
            j.PickUpLongitude = 174.76m;
            j.DeliveryLatitude = -36.80m;
            j.DeliveryLongitude = 174.76m;
        });

        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.InRange(pickup.UcjbAmount ?? 0m, 74.00m, 76.00m);
        Assert.Equal(100.00m, (pickup.UcjbAmount ?? 0m) + (delivery.UcjbAmount ?? 0m));

        // A straight-line estimate must not be written into the road-miles column.
        Assert.Null(pickup.TotalDistance);
        Assert.Null(delivery.TotalDistance);
    }

    [Fact]
    public async Task SplitJobAsync_HonoursTheConfirmedAllocation_WithoutRatingOrRouting()
    {
        SeedJob(configure: j => j.UcjbAmount = 89.00m);
        SeedParentPricingLines();
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            pricingAllocation:
            [
                new SplitPricingAllocationItem { Sequence = 1, SharePercent = 70m },
                new SplitPricingAllocationItem { Sequence = 2, SharePercent = 30m }
            ],
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        // 70% of 89.00 = 62.30, with the last leg absorbing the per-line remainder.
        Assert.Equal(62.30m, pickup.UcjbAmount);
        Assert.Equal(26.70m, delivery.UcjbAmount);

        // What the user confirmed is applied verbatim — no distance lookup, no rating call.
        await _rateJobServiceMock.DidNotReceiveWithAnyArgs()
            .GetRoadDistanceMilesAsync(default, default, default, default);
        await _rateJobServiceMock.DidNotReceive().GetJobRateNzAsync(Arg.Any<JobRatingDetailsDtoNz>());
    }

    [Fact]
    public async Task SplitJobAsync_HonoursAPerLineOverride_WithoutDisturbingTheOtherLines()
    {
        // The overall trip divides 65/35, but only the pickup leg's route went through the
        // congestion zone — that charge belongs wholly to leg A.
        SeedJob(configure: j => j.UcjbAmount = 89.00m);
        SeedParentPricingLines();
        var congestionId = _seedContext.PricingBreakdowns.Single(p => p.ChargeName == "Congestion")
            .PricingBreakdownId;
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            pricingAllocation:
            [
                new SplitPricingAllocationItem { Sequence = 1, SharePercent = 65m },
                new SplitPricingAllocationItem { Sequence = 2, SharePercent = 35m }
            ],
            lineAllocation:
            [
                new SplitPricingLineAllocationItem
                {
                    PricingBreakdownId = congestionId, Sequence = 1, SharePercent = 100m
                },
                new SplitPricingLineAllocationItem
                {
                    PricingBreakdownId = congestionId, Sequence = 2, SharePercent = 0m
                }
            ],
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        decimal Amount(int legJobId, string chargeName) =>
            lines.Single(l => l.ChildJobId == legJobId && l.ChargeName == chargeName).ChargeAmount;

        Assert.Equal(9.00m, Amount(pickupId, "Congestion Part A"));
        Assert.Equal(0.00m, Amount(deliveryId, "Congestion Part B"));
        Assert.Equal(41.60m, Amount(pickupId, "Base Part A"));
        Assert.Equal(22.40m, Amount(deliveryId, "Base Part B"));
        Assert.Equal(10.40m, Amount(pickupId, "Base Fuel Part A"));

        // The parent's line total — and therefore the client invoice — is still untouched.
        Assert.Equal(89.00m, lines.Sum(l => l.ChargeAmount));
        Assert.Equal(50.00m, lines.Sum(l => l.CostAmount ?? 0m));

        // Each leg's header follows its own rows, not the headline percentage.
        var pickup = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == pickupId,
            cancellationToken: TestContext.Current.CancellationToken);
        var delivery = await verifyCtx.TucJobs.FirstAsync(j => j.UcjbId == deliveryId,
            cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(61.00m, pickup.UcjbAmount);
        Assert.Equal(28.00m, delivery.UcjbAmount);
        Assert.Equal(34.60m, pickup.CourierPayment);
        Assert.Equal(15.40m, delivery.CourierPayment);
        Assert.Equal(10.40m, pickup.FuelSurchargeAmount);
        Assert.Equal(5.60m, delivery.FuelSurchargeAmount);
    }

    [Fact]
    public async Task SplitJobAsync_SynthesisesALine_WhenTheParentHasNoBreakdown()
    {
        // A flat/manually-priced parent has nothing itemised to divide, but each leg still needs a
        // row so its header and the Price Breakdown modal agree.
        SeedJob(configure: j =>
        {
            j.UcjbAmount = 100.00m;
            j.CourierPayment = 60.00m;
        });
        var service = CreateService();

        var (pickupId, _) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        Assert.Equal(2, lines.Count);
        Assert.Equal(
            new[] { "Manually Rated Part A", "Manually Rated Part B" },
            lines.Select(l => l.ChargeName).Order());
        Assert.Equal(100.00m, lines.Sum(l => l.ChargeAmount));
        Assert.Equal(60.00m, lines.Sum(l => l.CostAmount ?? 0m));
        Assert.Equal(50.00m, lines.First(l => l.ChildJobId == pickupId).ChargeAmount);
    }

    [Fact]
    public async Task SplitJobAsync_ReSplit_DividesOnlyTheLegBeingSplit()
    {
        SeedJob(configure: j => j.UcjbAmount = 100.00m);
        SeedParentPricingLines(baseAmount: 100.00m, fuelAmount: 0m, congestionAmount: 0m);
        var service = CreateService();

        var (pickupId, deliveryId) = await service.SplitJobAsync(100, "TestUser", CreateMeetingPointAddress(),
            ct: TestContext.Current.CancellationToken);
        var (subPickupId, subDeliveryId) = await service.SplitJobAsync(deliveryId, "TestUser",
            CreateMeetingPointAddress(), ct: TestContext.Current.CancellationToken);

        await using var verifyCtx = new DespatchContext(_db.Options);
        var lines = await verifyCtx.PricingBreakdowns.ToListAsync(TestContext.Current.CancellationToken);

        // The first split's surviving sibling keeps its own rows; only the re-split leg's rows are
        // replaced. Every row still hangs off the root, so the invoice total is still 100.
        Assert.All(lines, l => Assert.Equal(100, l.JobId));
        Assert.Equal(100.00m, lines.Sum(l => l.ChargeAmount));
        Assert.Equal(50.00m, lines.Where(l => l.ChildJobId == pickupId).Sum(l => l.ChargeAmount));
        Assert.DoesNotContain(lines, l => l.ChildJobId == deliveryId);
        Assert.Equal(25.00m, lines.Where(l => l.ChildJobId == subPickupId).Sum(l => l.ChargeAmount));
        Assert.Equal(25.00m, lines.Where(l => l.ChildJobId == subDeliveryId).Sum(l => l.ChargeAmount));
    }

    /// <summary>
    /// An already-split job in its post-KT1314V state: a 89.00/50.00 parent divided 65/35 across
    /// legs 101 and 102, with the congestion charge pinned wholly to leg A the way the split
    /// pricing dialog's per-line override leaves it.
    /// </summary>
    private void SeedSplitLegsWithPricingLines()
    {
        SeedJob(jobId: 100, jobNumber: "JOB-100", configure: j =>
        {
            j.JobRelationshipTypeId = (int)JobRelationshipTypes.SplitParent;
            j.RootParentId = 100;
            j.UcjbAmount = 89.00m;
        });

        _seedContext.TucJobs.AddRange(
            SplitLeg(101, "JOB-100A", sequence: 1, amount: 61.00m, distance: 9m),
            SplitLeg(102, "JOB-100B", sequence: 2, amount: 28.00m, distance: 1m));

        _seedContext.PricingBreakdowns.AddRange(
            LegLine(101, "Base Part A", 41.60m, 20.80m),
            LegLine(101, "Base Fuel Part A", 10.40m, 7.80m),
            LegLine(101, "Congestion Part A", 9.00m, 6.00m),
            LegLine(102, "Base Part B", 22.40m, 11.20m),
            LegLine(102, "Base Fuel Part B", 5.60m, 4.20m),
            LegLine(102, "Congestion Part B", 0.00m, 0.00m));

        _seedContext.SaveChanges();
        return;

        static TucJob SplitLeg(int jobId, string jobNumber, int sequence, decimal amount, decimal distance) =>
            new()
            {
                UcjbId = jobId,
                UcjbNumber = jobNumber,
                UcjbSpeed = 1,
                UcjbStatus = 3,
                UcjbDate = new DateTime(2024, 1, 15),
                ParentId = 100,
                RootParentId = 100,
                Sequence = sequence,
                UcjbAmount = amount,
                TotalDistance = distance
            };

        static PricingBreakdown LegLine(int legJobId, string name, decimal amount, decimal cost) =>
            new()
            {
                JobId = 100, ChildJobId = legJobId, ChargeName = name, ChargeAmount = amount,
                CostAmount = cost
            };
    }

    /// <summary>
    /// The KT1314V parent breakdown: Base 64.00/32.00, Base Fuel 16.00/12.00, Congestion 9.00/6.00.
    /// </summary>
    private void SeedParentPricingLines(
        decimal baseAmount = 64.00m, decimal fuelAmount = 16.00m, decimal congestionAmount = 9.00m)
    {
        _seedContext.PricingBreakdowns.AddRange(
            new PricingBreakdown
            {
                JobId = 100, ChargeName = "Base", ChargeAmount = baseAmount, CostAmount = baseAmount / 2m
            },
            new PricingBreakdown
            {
                JobId = 100, ChargeName = "Base Fuel", ChargeAmount = fuelAmount,
                CostAmount = fuelAmount * 0.75m
            },
            new PricingBreakdown
            {
                JobId = 100, ChargeName = "Congestion", ChargeAmount = congestionAmount,
                CostAmount = congestionAmount * 2m / 3m
            });
        _seedContext.SaveChanges();
    }
}