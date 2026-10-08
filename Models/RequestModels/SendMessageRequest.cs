namespace DespatchWeb.Models.RequestModels;

public sealed class SendMessageRequest : SendMessageBaseClass
{
    public int? SendToStaffId { get; init; }
    public int? SendToCourierId { get; init; }
}
