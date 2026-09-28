using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

public class PartnerJobGateTests
{
    private readonly IJobQueryRepository _jobQueryRepository = Substitute.For<IJobQueryRepository>();
    private readonly IJobChangeRequestService _changeRequestService = Substitute.For<IJobChangeRequestService>();
    private readonly ISendToPartnerService _sendToPartnerService = Substitute.For<ISendToPartnerService>();

    private PartnerJobGate CreateGate() =>
        new(_jobQueryRepository, _changeRequestService, _sendToPartnerService);

    [Fact]
    public async Task NonPartnerJob_ReturnsNotPartner_AndDoesNotCallChangeRequestService()
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(false);

        var result = await CreateGate().EvaluateAsync(1, JobProperty.SpeedID, "5", TestContext.Current.CancellationToken);

        Assert.IsType<PartnerJobGateResult.NotPartner>(result);
        await _changeRequestService.DidNotReceive().CreateLocalAsync(
            Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(JobProperty.CourierId)]
    [InlineData(JobProperty.Locked)]
    [InlineData(JobProperty.Status)]
    [InlineData(JobProperty.Void)]
    [InlineData(JobProperty.InternalStatusID)]
    [InlineData(JobProperty.ClientID)]
    [InlineData(JobProperty.PODName)]
    [InlineData(JobProperty.PickupArrivalTime)]
    public async Task PartnerJobLocalOnlyField_ReturnsLocalOnly(JobProperty property)
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);

        var result = await CreateGate().EvaluateAsync(1, property, "x", TestContext.Current.CancellationToken);

        Assert.IsType<PartnerJobGateResult.LocalOnly>(result);
        await _changeRequestService.DidNotReceive().CreateLocalAsync(
            Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>());
    }

    [Theory]
    [InlineData(JobProperty.RefA, "ABC")]
    [InlineData(JobProperty.ConNote, "note")]
    [InlineData(JobProperty.TrackingMobile, "0211234")]
    public async Task PartnerJobAutoField_FilesAutoApplied(JobProperty property, string value)
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);
        _changeRequestService.CreateLocalAsync(Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(new JobChangeRequestResult
            {
                Success = true,
                Request = new JobChangeRequestDto { Id = 42, Status = JobChangeRequestStatus.Applied }
            });

        var result = await CreateGate().EvaluateAsync(1, property, value, TestContext.Current.CancellationToken);

        var applied = Assert.IsType<PartnerJobGateResult.AutoApplied>(result);
        Assert.Equal(42, applied.RequestId);
    }

    [Theory]
    [InlineData(JobProperty.SpeedID, "5")]
    [InlineData(JobProperty.Date, "2026-05-21")]
    [InlineData(JobProperty.DGClass, "3")]
    [InlineData(JobProperty.FromContactName, "Jane")]
    [InlineData(JobProperty.ToContactPhone, "021-9999")]
    public async Task PartnerJobManualField_FilesPendingApproval(JobProperty property, string value)
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);
        _changeRequestService.CreateLocalAsync(Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(new JobChangeRequestResult
            {
                Success = true,
                Request = new JobChangeRequestDto { Id = 99, Status = JobChangeRequestStatus.Pending }
            });

        var result = await CreateGate().EvaluateAsync(1, property, value, TestContext.Current.CancellationToken);

        var pending = Assert.IsType<PartnerJobGateResult.PendingApproval>(result);
        Assert.Equal(99, pending.RequestId);
    }

    [Fact]
    public async Task PartnerJobUnsupportedField_ReturnsBlocked()
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);

        // Weight requires entity-tracked parent/child propagation; not in the gate
        // mapping until that path is wired into the change-request flow.
        var result = await CreateGate().EvaluateAsync(1, JobProperty.Weight, "10",
            TestContext.Current.CancellationToken);

        var blocked = Assert.IsType<PartnerJobGateResult.Blocked>(result);
        Assert.Contains("Weight", blocked.Message);
    }

    [Fact]
    public async Task ChangeRequestServiceFailure_PropagatesAsBlocked()
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);
        _changeRequestService.CreateLocalAsync(Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(new JobChangeRequestResult { Success = false, Message = "No active pairing" });

        var result = await CreateGate().EvaluateAsync(1, JobProperty.RefA, "x",
            TestContext.Current.CancellationToken);

        var blocked = Assert.IsType<PartnerJobGateResult.Blocked>(result);
        Assert.Equal("No active pairing", blocked.Message);
    }

    [Fact]
    public async Task JobChangeFieldOverload_NonPartner_ReturnsNotPartner()
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(false);

        var result = await CreateGate().EvaluateAsync(1, JobChangeField.Notes, "value", reason: null,
            TestContext.Current.CancellationToken);

        Assert.IsType<PartnerJobGateResult.NotPartner>(result);
    }

    [Fact]
    public async Task JobChangeFieldOverload_Partner_FilesChangeRequest()
    {
        _jobQueryRepository.IsPartnerJobAsync(1).Returns(true);
        _changeRequestService.CreateLocalAsync(Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(new JobChangeRequestResult
            {
                Success = true,
                Request = new JobChangeRequestDto { Id = 7, Status = JobChangeRequestStatus.Pending }
            });

        var result = await CreateGate().EvaluateAsync(1, JobChangeField.PartnerAgreedRate, "100", reason: "rate bump",
            TestContext.Current.CancellationToken);

        var pending = Assert.IsType<PartnerJobGateResult.PendingApproval>(result);
        Assert.Equal(7, pending.RequestId);
        await _changeRequestService.Received().CreateLocalAsync(
            Arg.Is<CreateJobChangeRequestRequest>(r =>
                r!.JobId == 1 &&
                r.FieldName == nameof(JobChangeField.PartnerAgreedRate) &&
                r.RequestedValue == "100" &&
                r.Reason == "rate bump"),
            Arg.Any<CancellationToken>());
    }

    // ── EvaluateAllocateAsync — Mode 1 rate-acceptance gate ────────────────

    [Fact]
    public async Task EvaluateAllocateAsync_IMReturnsNull_ReturnsNotPartner()
    {
        _sendToPartnerService.GetInboundJobAcceptanceStateAsync(1)
            .Returns((PartnerInboundJobAcceptanceStateResponse?)null);

        var result = await CreateGate().EvaluateAllocateAsync(1, TestContext.Current.CancellationToken);

        Assert.IsType<PartnerJobGateResult.NotPartner>(result);
    }

    [Theory]
    [InlineData("Allowed")]
    [InlineData("Accepted")]
    public async Task EvaluateAllocateAsync_OpenStates_ReturnsNotPartner(string status)
    {
        _sendToPartnerService.GetInboundJobAcceptanceStateAsync(1)
            .Returns(new PartnerInboundJobAcceptanceStateResponse { Status = status });

        var result = await CreateGate().EvaluateAllocateAsync(1, TestContext.Current.CancellationToken);

        Assert.IsType<PartnerJobGateResult.NotPartner>(result);
    }

    [Fact]
    public async Task EvaluateAllocateAsync_PendingAcceptance_ReturnsBlocked()
    {
        _sendToPartnerService.GetInboundJobAcceptanceStateAsync(1)
            .Returns(new PartnerInboundJobAcceptanceStateResponse { Status = "PendingAcceptance" });

        var result = await CreateGate().EvaluateAllocateAsync(1, TestContext.Current.CancellationToken);

        var blocked = Assert.IsType<PartnerJobGateResult.Blocked>(result);
        Assert.Contains("not been accepted", blocked.Message);
    }

    [Fact]
    public async Task EvaluateAllocateAsync_Rejected_ReturnsBlockedWithReason()
    {
        _sendToPartnerService.GetInboundJobAcceptanceStateAsync(1)
            .Returns(new PartnerInboundJobAcceptanceStateResponse
            {
                Status = "Rejected",
                RejectionReason = "Customer cancelled"
            });

        var result = await CreateGate().EvaluateAllocateAsync(1, TestContext.Current.CancellationToken);

        var blocked = Assert.IsType<PartnerJobGateResult.Blocked>(result);
        Assert.Contains("Customer cancelled", blocked.Message);
    }
}
