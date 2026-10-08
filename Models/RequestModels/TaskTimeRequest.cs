namespace DespatchWeb.Models.RequestModels;

public sealed class TaskTimeRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Time { get; init; }
}
