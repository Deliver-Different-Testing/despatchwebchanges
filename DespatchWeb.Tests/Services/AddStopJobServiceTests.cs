using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using NSubstitute;

// EditAddressDialogViewModel is in DespatchWeb.Models namespace (JobViewModel.cs)

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddStopJobService - tests extra stop job creation for live and recurring jobs.
/// </summary>
public class AddStopJobServiceTests
{
    private readonly IJobQueryRepository _jobQueryRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private TucJob _createdStopJob = new();
    private TucJobBooking _createdStopBooking = new();

    private AddStopJobService CreateService() => new(
        _jobQueryRepositoryMock,
        _jobCommandRepositoryMock,
        _tenantInfoServiceMock,
        _clock
    );

    [Fact]
    public async Task AddStopInsertJobAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertJobAsync(null!);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns((TucJob)null!);

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_NoShipmentDetails_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = new AddStopRequest
        {
            JobId = 1,
            PickUpAddress = new EditAddressDialogViewModel(),
            DeliveryAddress = new EditAddressDialogViewModel()
        };

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(CreateParentJob());

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_ValidRequest_CreatesNewJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        const int newJobId = 999;

        SetupSuccessfulMocks(request, parentJob, newJobId);

        // Act
        var result = await service.AddStopInsertJobAsync(request);

        // Assert
        Assert.Equal(newJobId, result);
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m!.JobNumber.StartsWith(parentJob.UcjbNumber)),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SetsFixedAmount()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert - Amount set via SP input, CourierPayment set post-load
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m!.Amount == 20m),
            Arg.Any<CancellationToken>());
        Assert.Equal(10m, _createdStopJob.CourierPayment);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_CreatesPricingBreakdown()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<PricingBreakdown>(p =>
            p!.ChargeAmount == 20m &&
            p.CostAmount == 10m &&
            p.ChargeName == "Extra Stop"));
    }

    [Fact]
    public async Task AddStopInsertJobAsync_WithJobNotes_CreatesNote()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.JobNotes = "Test note";
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<TucNote>(n =>
            n!.JobId == parentJob.UcjbId &&
            n.NoteText == "Test note" &&
            n.NoteTypeId == (int)NoteType.InternalNote));
    }

    [Fact]
    public async Task AddStopInsertJobAsync_WithoutJobNotes_DoesNotCreateNote()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.JobNotes = null;
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock
            .Received(0)
            .AddEntityAsync(Arg.Any<TucNote>());
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SetsAttentionFlagToTrue()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        Assert.True(_createdStopJob.UcjbAttention);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SetsRatedManuallyToTrue()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        Assert.True(_createdStopJob.RatedManually);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SetsParentIdFromJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        Assert.Equal(parentJob.UcjbId, _createdStopJob.ParentId);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_WithExistingParentId_UsesExistingParentId()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.ParentId = 500;

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        Assert.Equal(500, _createdStopJob.ParentId);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_WithPackages_CreatesPackages()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.Quantity = 3;
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().AddPackagesToJobAsync(
            parentJob.UcjbId,
            Arg.Is<List<TucJobItem>>(items => items!.Count == 3));
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertRecurringJobAsync(null!);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobQueryRepositoryMock.GetByIdAsync<TucJobBooking>(request.JobId)
            .Returns((TucJobBooking)null!);

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertRecurringJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_ValidRequest_CreatesNewBookingJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();
        const int newJobId = 888;

        SetupRecurringSuccessfulMocks(request, parentBooking, newJobId);

        // Act
        var result = await service.AddStopInsertRecurringJobAsync(request);

        // Assert
        Assert.Equal(newJobId, result);
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<TucJobBooking>(j =>
            j!.UcbkJobNumber.StartsWith(parentBooking.UcbkJobNumber)));
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_CreatesPricingBreakdownForBooking()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        // Act
        await service.AddStopInsertRecurringJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<PricingBreakdown>(p =>
            p!.PrebookJobId != null &&
            p.JobId == null &&
            p.ChargeName == "Extra Stop"));
    }

    [Fact]
    public async Task AddStopInsertJobAsync_FirstStop_AppendsLetterA()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "JOB001";

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m!.JobNumber == "JOB001a"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddStopInsertJobAsync_StopAExists_AppendsLetterB()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "JOB001";

        SetupSuccessfulMocks(request, parentJob, 999);
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001a")
            .Returns(true);
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001b")
            .Returns(false);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m!.JobNumber == "JOB001b"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddStopInsertJobAsync_AllSuffixesExhausted_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(parentJob);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(true); // All suffixes taken

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Unable to generate unique job number", ex.Message);
        return;

        // Act
        async Task<int> Act() => await service.AddStopInsertJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SpFailure_ThrowsInvalidOperationException()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(parentJob);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(false);
        _tenantInfoServiceMock.GetContactId().Returns(1);
        _jobCommandRepositoryMock.CreateMinimalTucJobAsync(
                Arg.Any<CreateMinimalTucJobInputModel>(), Arg.Any<CancellationToken>())
            .Returns(new CreateMinimalTucJobResponse { Success = false, Message = "SP error" });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Failed to create stop job", ex.Message);
        return;

        async Task<int> Act() => await service.AddStopInsertJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SpReturnsNullJobId_ThrowsInvalidOperationException()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(parentJob);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(false);
        _tenantInfoServiceMock.GetContactId().Returns(1);
        _jobCommandRepositoryMock.CreateMinimalTucJobAsync(
                Arg.Any<CreateMinimalTucJobInputModel>(), Arg.Any<CancellationToken>())
            .Returns(new CreateMinimalTucJobResponse { Success = true, JobId = null });

        var ex = await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        Assert.Contains("Failed to create stop job", ex.Message);
        return;

        async Task<int> Act() => await service.AddStopInsertJobAsync(request);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_SetsConstantFieldsOnCreatedJob()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        await service.AddStopInsertJobAsync(request);

        Assert.False(_createdStopJob.DisplayInDespatch);
        Assert.Equal(152, _createdStopJob.UcjbTo);
        Assert.Equal(13, _createdStopJob.JobRelationshipTypeId);
        Assert.Equal(0m, _createdStopJob.CourierFuel);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_CopiesWeightFromExtras()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.Weight = 7.5;
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        await service.AddStopInsertJobAsync(request);

        Assert.Equal(7.5, _createdStopJob.UcjbWeight);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_ZeroQuantity_DoesNotCreatePackages()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.Quantity = 0;
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        await service.AddStopInsertJobAsync(request);

        await _jobCommandRepositoryMock.DidNotReceive().AddPackagesToJobAsync(
            Arg.Any<int>(), Arg.Any<List<TucJobItem>>());
    }

    [Fact]
    public async Task AddStopInsertJobAsync_ShipmentDetailsFallback_UsesDeliveryAddress()
    {
        var service = CreateService();
        var request = new AddStopRequest
        {
            JobId = 1,
            PickUpAddress = new EditAddressDialogViewModel(),
            DeliveryAddress = new EditAddressDialogViewModel
            {
                ShipmentDetails = new ShipmentDetails
                {
                    Weight = 3.0,
                    Quantity = 2,
                    ContactName = "Delivery Contact",
                    ContactMobile = "0299999999"
                }
            }
        };
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        var result = await service.AddStopInsertJobAsync(request);

        Assert.Equal(999, result);
        Assert.Equal(3.0, _createdStopJob.UcjbWeight);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_CalculatesRawAmountFromRepository()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);
        _jobQueryRepositoryMock.GetNationwideServiceRawPriceAsync(
                Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<float?>(),
                Arg.Any<int?>(), Arg.Any<int?>())
            .Returns(42m);

        await service.AddStopInsertJobAsync(request);

        Assert.Equal(42m, _createdStopJob.RawAmount);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_WithJobNotes_CreatesNoteWithJobBookingId()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.JobNotes = "Booking note";
        var parentBooking = CreateParentBookingJob();

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<TucNote>(n =>
            n!.JobBookingId == parentBooking.UcbkId &&
            n.NoteText == "Booking note" &&
            n.NoteTypeId == (int)NoteType.InternalNote));
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_WithoutJobNotes_DoesNotCreateNote()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.JobNotes = null;
        var parentBooking = CreateParentBookingJob();

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        await _jobCommandRepositoryMock.DidNotReceive().AddEntityAsync(Arg.Any<TucNote>());
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_SetsConstantFields()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        Assert.True(_createdStopBooking.UcbkAttention);
        Assert.True(_createdStopBooking.RatedManually);
        Assert.Equal(20m, _createdStopBooking.UcbkAmount);
        Assert.Equal(10m, _createdStopBooking.CourierPayment);
        Assert.Equal(0m, _createdStopBooking.FuelSurchargeAmount);
        Assert.Equal(0m, _createdStopBooking.CourierFuel);
        Assert.Equal(152, _createdStopBooking.UcbkTo);
        Assert.Equal(13, _createdStopBooking.JobRelationshipTypeId);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_SetsParentIdFromBooking()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        Assert.Equal(parentBooking.UcbkId, _createdStopBooking.ParentId);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_WithExistingParentId_UsesExistingParentId()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();
        parentBooking.ParentId = 600;

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        Assert.Equal(600, _createdStopBooking.ParentId);
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_ContactAndQuantityFallback()
    {
        var service = CreateService();
        var request = CreateValidRequest();
        request.PickUpAddress.ShipmentDetails.ContactName = null;
        request.PickUpAddress.ShipmentDetails.ContactMobile = null;
        request.PickUpAddress.ShipmentDetails.Quantity = null;
        var parentBooking = CreateParentBookingJob();
        parentBooking.PickupFromContact = "Parent Contact";
        parentBooking.PickupFromPhone = "111";
        parentBooking.DeliverToContact = "Parent Deliver";
        parentBooking.DeliverToPhone = "222";
        parentBooking.Quantity = 5;

        SetupRecurringSuccessfulMocks(request, parentBooking, 888);

        await service.AddStopInsertRecurringJobAsync(request);

        Assert.Equal("Parent Contact", _createdStopBooking.PickupFromContact);
        Assert.Equal("111", _createdStopBooking.PickupFromPhone);
        Assert.Equal("Parent Deliver", _createdStopBooking.DeliverToContact);
        Assert.Equal("222", _createdStopBooking.DeliverToPhone);
        Assert.Equal((short)5, _createdStopBooking.Quantity);
    }

    private static AddStopRequest CreateValidRequest() => new()
    {
        JobId = 1,
        PickUpAddress = new EditAddressDialogViewModel
        {
            ShipmentDetails = new ShipmentDetails
            {
                Weight = 5.5,
                Quantity = 1,
                ContactName = "John Doe",
                ContactMobile = "0211234567"
            }
        },
        DeliveryAddress = new EditAddressDialogViewModel()
    };

    private static TucJob CreateParentJob() => new()
    {
        UcjbId = 1,
        UcjbNumber = "JOB001",
        UcjbDate = TestDates.Today,
        UcjbTime = TestDates.Today.AddHours(10),
        UcjbClientId = 1,
        UcjbStatus = 1,
        UcjbFrom = 100,
        UcjbFromAddr = "123 Origin St",
        UcjbTo = 200,
        UcjbToAddr = "456 Dest Ave",
        UcjbSpeed = 1,
        UcjbSize = 1
    };

    private static TucJobBooking CreateParentBookingJob() => new()
    {
        UcbkId = 1,
        UcbkJobNumber = "BK001",
        UcbkDate = TestDates.Today,
        UcbkTime = TestDates.Today.AddHours(10),
        UcbkClientId = 1,
        UcbkFrom = 100,
        UcbkFromAddr = "123 Origin St",
        UcbkTo = 200,
        UcbkToAddr = "456 Dest Ave",
        UcbkSpeed = 1,
        UcbkSize = 1
    };

    private void SetupSuccessfulMocks(AddStopRequest request, TucJob parentJob, int newJobId)
    {
        _createdStopJob = new TucJob { UcjbId = newJobId };

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(parentJob);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(false);
        _jobQueryRepositoryMock.GetNationwideServiceRawPriceAsync(
                Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<int?>(),
                Arg.Any<int?>(), Arg.Any<int?>(), Arg.Any<float?>(),
                Arg.Any<int?>(), Arg.Any<int?>())
            .Returns(15m);
        _tenantInfoServiceMock.GetStaffId()
            .Returns(1);
        _tenantInfoServiceMock.GetContactId()
            .Returns(1);

        _jobCommandRepositoryMock.CreateMinimalTucJobAsync(
                Arg.Any<CreateMinimalTucJobInputModel>(), Arg.Any<CancellationToken>())
            .Returns(new CreateMinimalTucJobResponse { Success = true, JobId = newJobId });
        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(newJobId)
            .Returns(_createdStopJob);
        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<TucNote>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<PricingBreakdown>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.AddPackagesToJobAsync(Arg.Any<int>(), Arg.Any<List<TucJobItem>>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.SaveChangesAsync()
            .Returns(Task.CompletedTask);
    }

    private void SetupRecurringSuccessfulMocks(AddStopRequest request, TucJobBooking parentBooking, int newJobId)
    {
        _jobQueryRepositoryMock.GetByIdAsync<TucJobBooking>(request.JobId)
            .Returns(parentBooking);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(false);
        _tenantInfoServiceMock.GetStaffId()
            .Returns(1);

        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<TucJobBooking>())
            .Returns(callInfo =>
            {                                                                                                                                                                   
                var j = callInfo.Arg<TucJobBooking>();
                j!.UcbkId = newJobId;                                                                                                                                            
                _createdStopBooking = j;                      
                return Task.CompletedTask;
            });
        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<TucNote>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<PricingBreakdown>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.SaveChangesAsync()
            .Returns(Task.CompletedTask);
    }

}
