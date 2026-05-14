using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

public class JobChangeRequestControllerTests
{
    private readonly IJobChangeRequestService _service = Substitute.For<IJobChangeRequestService>();

    private JobChangeRequestController CreateController() => new(_service);

    private static JobChangeRequestResult Ok(JobChangeRequestDto? dto = null) =>
        new() { Success = true, Request = dto };

    private static JobChangeRequestResult Fail(string message) =>
        new() { Success = false, Message = message };

    [Fact]
    public async Task Create_ServiceSucceeds_ReturnsOk()
    {
        var request = new CreateJobChangeRequestRequest { JobId = 1, FieldName = "PickupAddress" };
        var expected = Ok(new JobChangeRequestDto { Id = 99 });
        _service.CreateLocalAsync(request, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().Create(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
    }

    [Fact]
    public async Task Create_ServiceReturnsFailure_ReturnsBadRequest()
    {
        var request = new CreateJobChangeRequestRequest { JobId = 1, FieldName = "PickupAddress" };
        var failure = Fail("No active pairing");
        _service.CreateLocalAsync(request, Arg.Any<CancellationToken>()).Returns(failure);

        var result = await CreateController().Create(request, CancellationToken.None);

        var bad = Assert.IsType<BadRequestObjectResult>(result);
        Assert.Same(failure, bad.Value);
    }

    [Fact]
    public async Task Create_ServiceThrows_Returns500()
    {
        _service.CreateLocalAsync(Arg.Any<CreateJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .Create(new CreateJobChangeRequestRequest(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Approve_ServiceSucceeds_ReturnsOk_AndForwardsRequestId()
    {
        var request = new ApproveJobChangeRequestRequest { RequestId = 42 };
        var expected = Ok();
        _service.ApproveAsync(42, request, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().Approve(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
        await _service.Received(1).ApproveAsync(42, request, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Approve_ServiceReturnsFailure_ReturnsBadRequest()
    {
        var request = new ApproveJobChangeRequestRequest { RequestId = 42 };
        _service.ApproveAsync(42, request, Arg.Any<CancellationToken>()).Returns(Fail("Not pending"));

        var result = await CreateController().Approve(request, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Approve_ServiceThrows_Returns500()
    {
        _service.ApproveAsync(Arg.Any<int>(), Arg.Any<ApproveJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .Approve(new ApproveJobChangeRequestRequest(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Reject_ServiceSucceeds_ReturnsOk_AndForwardsRequestId()
    {
        var request = new RejectJobChangeRequestRequest { RequestId = 7, Reason = "Wrong price" };
        var expected = Ok();
        _service.RejectAsync(7, request, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().Reject(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
        await _service.Received(1).RejectAsync(7, request, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Reject_ServiceReturnsFailure_ReturnsBadRequest()
    {
        _service.RejectAsync(Arg.Any<int>(), Arg.Any<RejectJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(Fail("Already responded"));

        var result = await CreateController()
            .Reject(new RejectJobChangeRequestRequest { RequestId = 7 }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Reject_ServiceThrows_Returns500()
    {
        _service.RejectAsync(Arg.Any<int>(), Arg.Any<RejectJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .Reject(new RejectJobChangeRequestRequest(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task Cancel_ServiceSucceeds_ReturnsOk_AndForwardsRequestId()
    {
        var request = new CancelJobChangeRequestRequest { RequestId = 11 };
        var expected = Ok();
        _service.CancelAsync(11, request, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().Cancel(request, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
        await _service.Received(1).CancelAsync(11, request, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task Cancel_ServiceReturnsFailure_ReturnsBadRequest()
    {
        _service.CancelAsync(Arg.Any<int>(), Arg.Any<CancelJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .Returns(Fail("Origin is not Local"));

        var result = await CreateController()
            .Cancel(new CancelJobChangeRequestRequest { RequestId = 11 }, CancellationToken.None);

        Assert.IsType<BadRequestObjectResult>(result);
    }

    [Fact]
    public async Task Cancel_ServiceThrows_Returns500()
    {
        _service.CancelAsync(Arg.Any<int>(), Arg.Any<CancelJobChangeRequestRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .Cancel(new CancelJobChangeRequestRequest(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task ForJob_ReturnsJsonOfRows()
    {
        var rows = new List<JobChangeRequestDto> { new() { Id = 1 }, new() { Id = 2 } };
        _service.ListForJobAsync(55, Arg.Any<CancellationToken>()).Returns(rows);

        var result = await CreateController().ForJob(55, CancellationToken.None);

        var json = Assert.IsType<JsonResult>(result);
        Assert.Equivalent(rows, json.Value);
    }

    [Fact]
    public async Task ForJob_ServiceThrows_Returns500()
    {
        _service.ListForJobAsync(Arg.Any<int>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController().ForJob(55, CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task PeerInbound_ServiceSucceeds_ReturnsOk()
    {
        var payload = new PeerInboundChangeRequestPayload
        {
            PartnerJobGuid = Guid.NewGuid(),
            SourceRequestUuid = Guid.NewGuid(),
            FieldName = "DeliveryAddress"
        };
        var expected = Ok();
        _service.RecordPeerCreateAsync(payload, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().PeerInbound(payload, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
    }

    [Fact]
    public async Task PeerInbound_ServiceReturnsFailure_ReturnsNotFound()
    {
        _service.RecordPeerCreateAsync(Arg.Any<PeerInboundChangeRequestPayload>(), Arg.Any<CancellationToken>())
            .Returns(Fail("Job not found"));

        var result = await CreateController()
            .PeerInbound(new PeerInboundChangeRequestPayload(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task PeerInbound_ServiceThrows_Returns500()
    {
        _service.RecordPeerCreateAsync(Arg.Any<PeerInboundChangeRequestPayload>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .PeerInbound(new PeerInboundChangeRequestPayload(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task PeerDecision_ServiceSucceeds_ReturnsOk_AndForwardsSourceUuid()
    {
        var sourceUuid = Guid.NewGuid();
        var payload = new PeerInboundChangeDecisionPayload { Outcome = "Approved" };
        var expected = Ok();
        _service.RecordPeerDecisionAsync(sourceUuid, payload, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().PeerDecision(sourceUuid, payload, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
        await _service.Received(1).RecordPeerDecisionAsync(sourceUuid, payload, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PeerDecision_ServiceReturnsFailure_ReturnsNotFound()
    {
        _service.RecordPeerDecisionAsync(Arg.Any<Guid>(), Arg.Any<PeerInboundChangeDecisionPayload>(),
                Arg.Any<CancellationToken>())
            .Returns(Fail("Unknown sourceUuid"));

        var result = await CreateController()
            .PeerDecision(Guid.NewGuid(), new PeerInboundChangeDecisionPayload(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task PeerDecision_ServiceThrows_Returns500()
    {
        _service.RecordPeerDecisionAsync(Arg.Any<Guid>(), Arg.Any<PeerInboundChangeDecisionPayload>(),
                Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .PeerDecision(Guid.NewGuid(), new PeerInboundChangeDecisionPayload(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }

    [Fact]
    public async Task PeerApplied_ServiceSucceeds_ReturnsOk_AndForwardsSourceUuid()
    {
        var sourceUuid = Guid.NewGuid();
        var payload = new PeerInboundChangeAppliedPayload { NewCommercialAmount = 123.45m };
        var expected = Ok();
        _service.RecordPeerAppliedAsync(sourceUuid, payload, Arg.Any<CancellationToken>()).Returns(expected);

        var result = await CreateController().PeerApplied(sourceUuid, payload, CancellationToken.None);

        var ok = Assert.IsType<OkObjectResult>(result);
        Assert.Same(expected, ok.Value);
        await _service.Received(1).RecordPeerAppliedAsync(sourceUuid, payload, Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task PeerApplied_ServiceReturnsFailure_ReturnsNotFound()
    {
        _service.RecordPeerAppliedAsync(Arg.Any<Guid>(), Arg.Any<PeerInboundChangeAppliedPayload>(),
                Arg.Any<CancellationToken>())
            .Returns(Fail("Unknown sourceUuid"));

        var result = await CreateController()
            .PeerApplied(Guid.NewGuid(), new PeerInboundChangeAppliedPayload(), CancellationToken.None);

        Assert.IsType<NotFoundObjectResult>(result);
    }

    [Fact]
    public async Task PeerApplied_ServiceThrows_Returns500()
    {
        _service.RecordPeerAppliedAsync(Arg.Any<Guid>(), Arg.Any<PeerInboundChangeAppliedPayload>(),
                Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("boom"));

        var result = await CreateController()
            .PeerApplied(Guid.NewGuid(), new PeerInboundChangeAppliedPayload(), CancellationToken.None);

        var status = Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, status.StatusCode);
    }
}
