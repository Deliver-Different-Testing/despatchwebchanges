using System;
using System.Collections.Concurrent;
using System.Linq;
using System.Threading;

namespace DespatchWeb.Services;

public sealed class BackgroundTaskStatus
{
    public string Status { get; set; } = "Running";
    public string ErrorMessage { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public sealed class BackgroundTaskTracker : IDisposable
{
    private readonly ConcurrentDictionary<string, BackgroundTaskStatus> _tasks = new();
    private readonly Timer _cleanupTimer;

    public BackgroundTaskTracker() => _cleanupTimer = new Timer(Cleanup, null, TimeSpan.FromSeconds(60), TimeSpan.FromSeconds(60));

    public string CreateTask()
    {
        var taskId = Guid.NewGuid().ToString("N");
        _tasks[taskId] = new BackgroundTaskStatus();
        return taskId;
    }

    public void SetCompleted(string taskId)
    {
        if (_tasks.TryGetValue(taskId, out var status)) status.Status = "Completed";
    }

    public void SetFailed(string taskId, string errorMessage)
    {
        if (!_tasks.TryGetValue(taskId, out var status)) return;
        status.Status = "Failed";
        status.ErrorMessage = errorMessage;
    }

    public BackgroundTaskStatus GetStatus(string taskId) => _tasks.TryGetValue(taskId, out var status) ? status : null;

    private void Cleanup(object state)
    {
        var cutoff = DateTime.UtcNow.AddMinutes(-5);
        var expiredKeys = _tasks.Where(kvp => kvp.Value.CreatedAt < cutoff).Select(kvp => kvp.Key).ToList();
        foreach (var key in expiredKeys) _tasks.TryRemove(key, out _);
    }

    public void Dispose() => _cleanupTimer.Dispose();
}
