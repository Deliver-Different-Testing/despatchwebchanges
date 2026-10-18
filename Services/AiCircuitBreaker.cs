namespace DespatchWeb.Services;

/// <summary>
/// Stops hammering a failing Anthropic API: after a run of consecutive failures AI calls
/// fail immediately for a cooldown, so dispatchers get an instant "unavailable" instead of
/// waiting out a timeout on every click. The first call after the cooldown is a probe — if it
/// fails the breaker reopens at once.
/// </summary>
public sealed class AiCircuitBreaker
{
    private readonly object _gate = new();
    private readonly TimeProvider _time;
    private readonly int _failureThreshold;
    private readonly TimeSpan _openFor;
    private int _consecutiveFailures;
    private DateTimeOffset _openUntil = DateTimeOffset.MinValue;

    public AiCircuitBreaker() : this(TimeProvider.System, 5, TimeSpan.FromSeconds(30))
    {
    }

    internal AiCircuitBreaker(TimeProvider time, int failureThreshold, TimeSpan openFor)
    {
        _time = time;
        _failureThreshold = failureThreshold;
        _openFor = openFor;
    }

    public bool IsOpen
    {
        get
        {
            lock (_gate)
            {
                return _time.GetUtcNow() < _openUntil;
            }
        }
    }

    public void RecordSuccess()
    {
        lock (_gate)
        {
            _consecutiveFailures = 0;
            _openUntil = DateTimeOffset.MinValue;
        }
    }

    public void RecordFailure()
    {
        lock (_gate)
        {
            _consecutiveFailures++;
            if (_consecutiveFailures >= _failureThreshold)
            {
                _openUntil = _time.GetUtcNow() + _openFor;
            }
        }
    }
}
