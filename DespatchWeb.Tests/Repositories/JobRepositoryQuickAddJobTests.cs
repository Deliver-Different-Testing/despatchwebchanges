using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// QuickAddJobAsync no longer inserts directly into the DB — it routes job creation
/// through the sister api project via <see cref="IJobApiClient"/>. These tests verify
/// that delegation contract (return value pass-through and error propagation). The
/// actual mapping/HTTP behaviour is covered by JobApiClientTests / DespatchApiClientTests.
/// </summary>
public class JobRepositoryQuickAddJobTests
{
    private readonly IDbContextFactory<DespatchContext> _contextFactory = Substitute.For<IDbContextFactory<DespatchContext>>();
    private readonly ITenantInfoService _infoService = Substitute.For<ITenantInfoService>();
    private readonly ITenantClock _clock = Substitute.For<ITenantClock>();
    private readonly IClearListEnvelopeService _clearListEnvelope = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobService = Substitute.For<ICreateJobService>();
    private readonly IJobApiClient _jobApiClient = Substitute.For<IJobApiClient>();

    private JobRepository CreateRepository() => new(
        _contextFactory,
        _infoService,
        _clock,
        _clearListEnvelope,
        _createJobService,
        _jobApiClient);

    private static JobCreateViewModel Request() => new() { ClientId = 1, SpeedId = 2 };

    [Fact]
    public async Task QuickAddJobAsync_DelegatesToJobApiClient_AndReturnsJobId()
    {
        var request = Request();
        _jobApiClient.QuickCreateAsync(request).Returns(987);

        var result = await CreateRepository().QuickAddJobAsync(request);

        Assert.Equal(987, result);
        await _jobApiClient.Received(1).QuickCreateAsync(request);
    }

    [Fact]
    public async Task QuickAddJobAsync_WhenApiClientThrows_Rethrows()
    {
        var request = Request();
        _jobApiClient.QuickCreateAsync(request)
            .ThrowsAsync(new InvalidOperationException("Job API rejected request"));

        await Assert.ThrowsAsync<InvalidOperationException>(
            () => CreateRepository().QuickAddJobAsync(request));
    }
}
