using DespatchWeb.Services;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace DespatchWeb;

public class EfModelWarmupHealthCheck(EfModelWarmupState state) : IHealthCheck
{
    public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context,
        CancellationToken cancellationToken = default) =>
        Task.FromResult(state.Failure is { } failure
            ? HealthCheckResult.Unhealthy("EF model warm-up failed", failure)
            : state.IsReady
                ? HealthCheckResult.Healthy("EF model warmed up")
                : HealthCheckResult.Unhealthy("EF model warming up"));
}
