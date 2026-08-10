using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Services;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for the dispatcher arrival-field edit turning into a waiting-time rerate:
/// derive the waited minutes, then run the normal live-job NZ rerate path so the
/// waiting charge comes out of rating rather than a hand-written breakdown row.
/// </summary>
public class ArrivalWaitRerateServiceTests
{
    private readonly IJobQueryRepository _jobQueryRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly IRateJobService _rateJobServiceMock = Substitute.For<IRateJobService>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    private const int JobId = 4242;

    public ArrivalWaitRerateServiceTests()
    {
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _jobQueryRepositoryMock.IsJobArchived(JobId).Returns(false);
        _jobCommandRepositoryMock.UpdateWaitedMinutesFromArrivalAsync(JobId, Arg.Any<JobProperty>()).Returns(25);
        _jobQueryRepositoryMock.GetJobDetailsForRatingNzAsync(JobId, false)
            .Returns(new JobRatingDetailsDtoNz { JobId = JobId });
    }

    private ArrivalWaitRerateService CreateService() => new(
        _jobQueryRepositoryMock,
        _jobCommandRepositoryMock,
        _rateJobServiceMock,
        _tenantInfoServiceMock
    );

    [Theory]
    [InlineData(JobProperty.PickupArrivalTime)]
    [InlineData(JobProperty.DeliveryArrivalTime)]
    public async Task HandleArrivalEditAsync_ArrivalField_DerivesMinutesThenRerates(JobProperty field)
    {
        await CreateService().HandleArrivalEditAsync(JobId, field, TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.Received(1).UpdateWaitedMinutesFromArrivalAsync(JobId, field);
        await _rateJobServiceMock.Received(1)
            .RateJobNzAsync(Arg.Is<JobRatingDetailsDtoNz>(d => d != null && d.JobId == JobId));
    }

    [Theory]
    [InlineData(JobProperty.RefA)]
    [InlineData(JobProperty.PuTime)]
    [InlineData(JobProperty.CompletedTime)]
    public async Task HandleArrivalEditAsync_NonArrivalField_DoesNothing(JobProperty field)
    {
        await CreateService().HandleArrivalEditAsync(JobId, field, TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.DidNotReceiveWithAnyArgs().UpdateWaitedMinutesFromArrivalAsync(0, default);
        await _rateJobServiceMock.DidNotReceiveWithAnyArgs().RateJobNzAsync(null!);
    }

    [Fact]
    public async Task HandleArrivalEditAsync_ArchivedJob_DoesNotDeriveOrRerate()
    {
        _jobQueryRepositoryMock.IsJobArchived(JobId).Returns(true);

        await CreateService().HandleArrivalEditAsync(JobId, JobProperty.PickupArrivalTime,
            TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.DidNotReceiveWithAnyArgs().UpdateWaitedMinutesFromArrivalAsync(0, default);
        await _rateJobServiceMock.DidNotReceiveWithAnyArgs().RateJobNzAsync(null!);
    }

    [Fact]
    public async Task HandleArrivalEditAsync_NoWaitingBasis_DoesNotRerate()
    {
        _jobCommandRepositoryMock
            .UpdateWaitedMinutesFromArrivalAsync(JobId, JobProperty.DeliveryArrivalTime)
            .Returns((int?)null);

        await CreateService().HandleArrivalEditAsync(JobId, JobProperty.DeliveryArrivalTime,
            TestContext.Current.CancellationToken);

        await _rateJobServiceMock.DidNotReceiveWithAnyArgs().RateJobNzAsync(null!);
    }

    [Fact]
    public async Task HandleArrivalEditAsync_UsTenant_PersistsMinutesButSkipsNzRerate()
    {
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await CreateService().HandleArrivalEditAsync(JobId, JobProperty.PickupArrivalTime,
            TestContext.Current.CancellationToken);

        await _jobCommandRepositoryMock.Received(1)
            .UpdateWaitedMinutesFromArrivalAsync(JobId, JobProperty.PickupArrivalTime);
        await _rateJobServiceMock.DidNotReceiveWithAnyArgs().RateJobNzAsync(null!);
    }

    [Fact]
    public async Task HandleArrivalEditAsync_RatingThrows_DoesNotPropagate()
    {
        _rateJobServiceMock.RateJobNzAsync(Arg.Any<JobRatingDetailsDtoNz>())
            .ThrowsAsync(new InvalidOperationException("rating unavailable"));

        var exception = await Record.ExceptionAsync(() => CreateService()
            .HandleArrivalEditAsync(JobId, JobProperty.PickupArrivalTime, TestContext.Current.CancellationToken));

        Assert.Null(exception);
    }
}
