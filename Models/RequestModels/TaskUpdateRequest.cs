using System;

namespace DespatchWeb.Models.RequestModels;

public class TaskUpdateBaseRequest
{
    public int EventId { get; set; }
}

public class TaskCloseRequest : TaskUpdateBaseRequest
{
    public bool Closed { get; set; }
}

public class TaskDateRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Date { get; set; }
}

public class TaskTimeRequest : TaskUpdateBaseRequest
{
    public DateTimeOffset Time { get; set; }
}

public class TaskAssignStaffRequest : TaskUpdateBaseRequest
{
    public int StaffId { get; set; }
}

