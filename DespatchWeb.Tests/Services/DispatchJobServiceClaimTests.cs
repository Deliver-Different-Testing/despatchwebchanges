using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class DispatchJobServiceClaimTests
{
    private readonly IJobCommandRepository _jobs = Substitute.For<IJobCommandRepository>();
    private readonly ICourierRepository _couriers = Substitute.For<ICourierRepository>();
    private readonly CancellationToken _ct = TestContext.Current.CancellationToken;

    public DispatchJobServiceClaimTests()
    {
        _jobs.IsActiveStaffAsync(9, _ct).Returns(true);
        _jobs.IsActiveCourierAsync(7, _ct).Returns(true);
    }

    private DispatchJobService Service() => new(_jobs, _couriers);

    [Fact]
    public async Task Claim_WithValidPeople_ReturnsTheRepositoryOutcome()
    {
        _jobs.ClaimJobForCourierAsync(1, 7, 9, _ct).Returns(CourierClaimOutcome.Assigned);

        Assert.Equal(CourierClaimOutcome.Assigned, await Service().ClaimJobForCourierAsync(1, 7, 9, _ct));
    }

    [Fact]
    public async Task Claim_WithAnInactiveStaff_IsInvalidStaff_AndNeverClaims()
    {
        _jobs.IsActiveStaffAsync(9, _ct).Returns(false);

        Assert.Equal(CourierClaimOutcome.InvalidStaff, await Service().ClaimJobForCourierAsync(1, 7, 9, _ct));
        await _jobs.DidNotReceiveWithAnyArgs().ClaimJobForCourierAsync(default, default, default, default);
    }

    [Fact]
    public async Task Claim_WithAnInactiveCourier_IsInvalidCourier_AndNeverClaims()
    {
        _jobs.IsActiveCourierAsync(7, _ct).Returns(false);

        Assert.Equal(CourierClaimOutcome.InvalidCourier, await Service().ClaimJobForCourierAsync(1, 7, 9, _ct));
        await _jobs.DidNotReceiveWithAnyArgs().ClaimJobForCourierAsync(default, default, default, default);
    }
}
