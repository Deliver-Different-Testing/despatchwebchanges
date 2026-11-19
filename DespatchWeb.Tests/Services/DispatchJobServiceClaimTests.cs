using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class DispatchJobServiceClaimTests
{
    private readonly IJobCommandRepository _jobs = Substitute.For<IJobCommandRepository>();
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;

    [Theory]
    [InlineData(CourierClaimOutcome.Assigned)]
    [InlineData(CourierClaimOutcome.InvalidStaff)]
    [InlineData(CourierClaimOutcome.InvalidCourier)]
    public async Task Claim_ReturnsTheRepositoryOutcome(CourierClaimOutcome outcome)
    {
        _jobs.ClaimJobForCourierAsync(1, 7, 9, _ct).Returns(outcome);

        Assert.Equal(outcome,
            await new DispatchJobService(_jobs, Substitute.For<ICourierRepository>()).ClaimJobForCourierAsync(1, 7, 9, _ct));
    }
}
