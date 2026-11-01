#nullable enable
using System.Diagnostics;
using DespatchWeb.EntityClasses;
using DespatchWeb.Interceptors;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Builds the EF Core model, and compiles one query, before the pod reports ready.
/// The DespatchContext model is large enough that building it lazily on the first
/// request stalls every concurrent request on a fresh pod for tens of seconds.
/// </summary>
public sealed class EfModelWarmupService(
    IOptions<DbContextOptions<DespatchContext>> baseOptions,
    StaffSessionContextInterceptor staffSessionContextInterceptor,
    EfModelWarmupState state,
    Action<DespatchContext>? warm = null) : BackgroundService
{
    // Never connected to: building the model and translating a query need no database.
    internal const string PlaceholderConnectionString = "Server=warmup;Database=warmup";

    private readonly Action<DespatchContext> _warm = warm ?? WarmModelAndQueryPipeline;

    protected override Task ExecuteAsync(CancellationToken stoppingToken) => Task.Run(Warm, stoppingToken);

    private void Warm()
    {
        var stopwatch = Stopwatch.StartNew();
        try
        {
            // Must match the request-path options exactly, or EF caches a second model.
            using var context = new DespatchContext(DynamicDespatchDbContextFactory.BuildOptions(
                baseOptions.Value, PlaceholderConnectionString, staffSessionContextInterceptor));
            _warm(context);

            state.MarkReady();
            Log.Information("EF model warm-up completed in {ElapsedMs}ms", stopwatch.ElapsedMilliseconds);
        }
        catch (Exception ex)
        {
            state.MarkFailed(ex);
            Log.Error(ex, "EF model warm-up failed after {ElapsedMs}ms", stopwatch.ElapsedMilliseconds);
        }
    }

    private static void WarmModelAndQueryPipeline(DespatchContext context) =>
        _ = context.TucJobs.Where(j => j.UcjbId > 0).OrderBy(j => j.UcjbId).Take(1).ToQueryString();
}
