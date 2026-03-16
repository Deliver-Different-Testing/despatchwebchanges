namespace DespatchWeb.Models.RequestModels;

public sealed class SendMessageRequest : SendMessageBaseClass
{
    public int? SendToStaffId { get; init; }
    public int? SendToCourierId { get; init; }
}

public sealed class SendMultipleMessageRequest(List<int> sendToStaffIds, List<int> sendToCourierIds) : SendMessageBaseClass
{
    public List<int> SendToStaffIds { get; init; } = sendToStaffIds;
    public List<int> SendToCourierIds { get; init; } = sendToCourierIds;
}

public class SendMessageBaseClass
{
    public string Message { get; init; }
    public int MessageType { get; init; }
}