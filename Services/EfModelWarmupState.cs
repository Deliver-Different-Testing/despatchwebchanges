#nullable enable
namespace DespatchWeb.Services;

public sealed class EfModelWarmupState
{
    private readonly TaskCompletionSource _completion = new(TaskCreationOptions.RunContinuationsAsynchronously);

    public bool IsReady => _completion.Task.IsCompleted && Failure is null;

    public Exception? Failure { get; private set; }

    /// <summary>Completes when the warm-up finishes, whether it succeeded or failed.</summary>
    public Task Completion => _completion.Task;

    public void MarkReady() => _completion.TrySetResult();

    public void MarkFailed(Exception exception)
    {
        Failure = exception;
        _completion.TrySetResult();
    }
}
