using System;

namespace DespatchWeb.Models.RequestModels;

public class TaskUpdateBaseRequest
{
    public int EventId { get; init; }
}

public class TaskCloseRequest : TaskUpdateBaseRequest
{
    public bool Closed { get; init; }
}

public class TaskDateRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Date { get; init; }
}

public class TaskTimeRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Time { get; init; }
}

public class TaskAssignStaffRequest : TaskUpdateBaseRequest
{
    public int StaffId { get; init; }
}

