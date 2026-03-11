using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

// EditAddressDialogViewModel is in DespatchWeb.Models namespace (JobViewModel.cs)

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddStopJobService - tests extra stop job creation for live and recurring jobs.
/// </summary>
public class AddStopJobServiceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private TucJob _createdStopJob;

    private AddStopJobService CreateService() => new(
        _jobRepositoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock
    );

    #region AddStopInsertJobAsync Validation Tests

    [Fact]
    public async Task AddStopInsertJobAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.AddStopInsertJobAsync(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task AddStopInsertJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync((TucJob)null!);

        // Act
        var act = async () => await service.AddStopInsertJobAsync(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
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

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync(CreateParentJob());

        // Act
        var act = async () => await service.AddStopInsertJobAsync(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    #endregion

    #region AddStopInsertJobAsync Workflow Tests

    [Fact]
    public async Task AddStopInsertJobAsync_ValidRequest_CreatesNewJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        var newJobId = 999;

        SetupSuccessfulMocks(request, parentJob, newJobId);

        // Act
        var result = await service.AddStopInsertJobAsync(request);

        // Assert
        result.Should().Be(newJobId);
        _jobRepositoryMock.Verify(x => x.CreateMinimalTucJobAsync(
            It.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber.StartsWith(parentJob.UcjbNumber)),
            It.IsAny<CancellationToken>()), Times.Once);
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
        _jobRepositoryMock.Verify(x => x.CreateMinimalTucJobAsync(
            It.Is<CreateMinimalTucJobInputModel>(m => m.Amount == 20m),
            It.IsAny<CancellationToken>()), Times.Once);
        _createdStopJob.CourierPayment.Should().Be(10m);
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
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<PricingBreakdown>(p =>
            p.ChargeAmount == 20m &&
            p.CostAmount == 10m &&
            p.ChargeName == "Extra Stop")), Times.Once);
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
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucNote>(n =>
            n.JobId == parentJob.UcjbId &&
            n.NoteText == "Test note" &&
            n.NoteTypeId == (int)NoteType.InternalNote)), Times.Once);
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
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.IsAny<TucNote>()), Times.Never);
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
        _createdStopJob.UcjbAttention.Should().BeTrue();
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
        _createdStopJob.RatedManually.Should().BeTrue();
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
        _createdStopJob.ParentId.Should().Be(parentJob.UcjbId);
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
        _createdStopJob.ParentId.Should().Be(500);
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
        _jobRepositoryMock.Verify(x => x.AddPackagesToJobAsync(
            parentJob.UcjbId,
            It.Is<List<TucJobItem>>(items => items.Count == 3)), Times.Once);
    }

    #endregion

    #region AddStopInsertRecurringJobAsync Validation Tests

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_NullRequest_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.AddStopInsertRecurringJobAsync(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJobBooking>(request.JobId))
            .ReturnsAsync((TucJobBooking)null!);

        // Act
        var act = async () => await service.AddStopInsertRecurringJobAsync(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    #endregion

    #region AddStopInsertRecurringJobAsync Workflow Tests

    [Fact]
    public async Task AddStopInsertRecurringJobAsync_ValidRequest_CreatesNewBookingJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentBooking = CreateParentBookingJob();
        var newJobId = 888;

        SetupRecurringSuccessfulMocks(request, parentBooking, newJobId);

        // Act
        var result = await service.AddStopInsertRecurringJobAsync(request);

        // Assert
        result.Should().Be(newJobId);
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJobBooking>(j =>
            j.UcbkJobNumber.StartsWith(parentBooking.UcbkJobNumber))), Times.Once);
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
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<PricingBreakdown>(p =>
            p.PrebookJobId != null &&
            p.JobId == null &&
            p.ChargeName == "Extra Stop")), Times.Once);
    }

    #endregion

    #region Job Number Generation Tests

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
        _jobRepositoryMock.Verify(x => x.CreateMinimalTucJobAsync(
            It.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001a"),
            It.IsAny<CancellationToken>()), Times.Once);
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
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync("JOB001a"))
            .ReturnsAsync(true);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync("JOB001b"))
            .ReturnsAsync(false);

        // Act
        await service.AddStopInsertJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.CreateMinimalTucJobAsync(
            It.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001b"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task AddStopInsertJobAsync_AllSuffixesExhausted_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync(parentJob);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync(It.IsAny<string>()))
            .ReturnsAsync(true); // All suffixes taken

        // Act
        var act = async () => await service.AddStopInsertJobAsync(request);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*Unable to generate unique job number*");
    }

    #endregion

    #region Helper Methods

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

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync(parentJob);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync(It.IsAny<string>()))
            .ReturnsAsync(false);
        _jobRepositoryMock.Setup(x => x.GetNationwideServiceRawPriceAsync(
                It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<int?>(),
                It.IsAny<int?>(), It.IsAny<int?>(), It.IsAny<float?>(),
                It.IsAny<int?>(), It.IsAny<int?>()))
            .ReturnsAsync(15m);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId())
            .Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetContactId())
            .Returns(1);

        _jobRepositoryMock.Setup(x => x.CreateMinimalTucJobAsync(
                It.IsAny<CreateMinimalTucJobInputModel>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new CreateMinimalTucJobResponse { Success = true, JobId = newJobId });
        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(newJobId))
            .ReturnsAsync(_createdStopJob);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<TucNote>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<PricingBreakdown>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddPackagesToJobAsync(It.IsAny<int>(), It.IsAny<List<TucJobItem>>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.SaveChangesAsync())
            .Returns(Task.CompletedTask);
    }

    private void SetupRecurringSuccessfulMocks(AddStopRequest request, TucJobBooking parentBooking, int newJobId)
    {
        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJobBooking>(request.JobId))
            .ReturnsAsync(parentBooking);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync(It.IsAny<string>()))
            .ReturnsAsync(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId())
            .Returns(1);

        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<TucJobBooking>()))
            .Callback<TucJobBooking>(j => j.UcbkId = newJobId)
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<TucNote>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<PricingBreakdown>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.SaveChangesAsync())
            .Returns(Task.CompletedTask);
    }

    #endregion
}
