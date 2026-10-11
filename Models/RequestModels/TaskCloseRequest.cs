namespace DespatchWeb.Models.RequestModels;

public sealed class TaskCloseRequest : TaskUpdateBaseRequest
{
    public bool Closed { get; init; }
}
