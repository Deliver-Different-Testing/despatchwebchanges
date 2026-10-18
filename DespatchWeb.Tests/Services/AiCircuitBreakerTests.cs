using DespatchWeb.Services;

namespace DespatchWeb.Tests.Services;

public class AiCircuitBreakerTests
{
    private readonly ManualTimeProvider _time = new();

    private AiCircuitBreaker Create() => new(_time, failureThreshold: 3, openFor: TimeSpan.FromSeconds(30));

    [Fact]
    public void StaysClosedBelowTheFailureThreshold()
    {
        var breaker = Create();

        breaker.RecordFailure();
        breaker.RecordFailure();

        Assert.False(breaker.IsOpen);
    }

    [Fact]
    public void OpensAfterConsecutiveFailures_AndClosesAfterTheCooldown()
    {
        var breaker = Create();
        for (var i = 0; i < 3; i++)
        {
            breaker.RecordFailure();
        }

        Assert.True(breaker.IsOpen);

        _time.Advance(TimeSpan.FromSeconds(31));

        Assert.False(breaker.IsOpen);
    }

    [Fact]
    public void ASuccessResetsTheConsecutiveCount()
    {
        var breaker = Create();
        breaker.RecordFailure();
        breaker.RecordFailure();
        breaker.RecordSuccess();
        breaker.RecordFailure();
        breaker.RecordFailure();

        Assert.False(breaker.IsOpen);
    }

    [Fact]
    public void AFailedProbeAfterTheCooldownReopensImmediately()
    {
        var breaker = Create();
        for (var i = 0; i < 3; i++)
        {
            breaker.RecordFailure();
        }

        _time.Advance(TimeSpan.FromSeconds(31));
        breaker.RecordFailure();

        Assert.True(breaker.IsOpen);
    }
}

internal sealed class ManualTimeProvider : TimeProvider
{
    private DateTimeOffset _now = new(2026, 10, 19, 9, 0, 0, TimeSpan.Zero);

    public override DateTimeOffset GetUtcNow() => _now;

    public void Advance(TimeSpan by) => _now += by;
}
