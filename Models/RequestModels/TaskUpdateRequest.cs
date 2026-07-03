namespace DespatchWeb.Models.RequestModels;

public class TaskUpdateBaseRequest
{
    public int EventId { get; init; }
}

public sealed class TaskCloseRequest : TaskUpdateBaseRequest
{
    public bool Closed { get; init; }
}

public sealed class TaskDateRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Date { get; init; }
}

public sealed class TaskTimeRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Time { get; init; }
}

public sealed class TaskAssignStaffRequest : TaskUpdateBaseRequest
{
    public int StaffId { get; init; }
}

public sealed class TaskUnassignRequest : TaskUpdateBaseRequest
{
}

