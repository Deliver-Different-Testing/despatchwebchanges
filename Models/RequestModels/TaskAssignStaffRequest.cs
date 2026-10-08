namespace DespatchWeb.Models.RequestModels;

public sealed class TaskAssignStaffRequest : TaskUpdateBaseRequest
{
    public int StaffId { get; init; }
}
