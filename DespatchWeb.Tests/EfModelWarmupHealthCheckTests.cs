using DespatchWeb.Services;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DespatchWeb.Tests;

public sealed class EfModelWarmupHealthCheckTests
{
    private static Task<HealthCheckResult> Check(EfModelWarmupState state) =>
        new EfModelWarmupHealthCheck(state).CheckHealthAsync(new HealthCheckContext(),
            TestContext.Current.CancellationToken);

    [Fact]
    public async Task IsUnhealthy_UntilWarmupCompletes_ThenHealthy()
    {
        var state = new EfModelWarmupState();

        Assert.Equal(HealthStatus.Unhealthy, (await Check(state)).Status);

        state.MarkReady();

        Assert.Equal(HealthStatus.Healthy, (await Check(state)).Status);
    }

    [Fact]
    public async Task IsUnhealthy_WithTheException_WhenWarmupFailed()
    {
        var state = new EfModelWarmupState();
        var failure = new InvalidOperationException("model is broken");

        state.MarkFailed(failure);
        var result = await Check(state);

        Assert.Equal(HealthStatus.Unhealthy, result.Status);
        Assert.Same(failure, result.Exception);
    }
}
