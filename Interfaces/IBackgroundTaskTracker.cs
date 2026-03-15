using DespatchWeb.Services;

namespace DespatchWeb.Interfaces;

public interface IBackgroundTaskTracker
{
    string CreateTask();
    void SetCompleted(string taskId);
    void SetFailed(string taskId, string errorMessage);
    BackgroundTaskStatus GetStatus(string taskId);
}