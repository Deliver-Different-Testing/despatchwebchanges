namespace DespatchWeb.Models.RequestModels;

public sealed class TaskDateRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Date { get; init; }
}
