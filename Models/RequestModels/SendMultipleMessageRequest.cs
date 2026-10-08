namespace DespatchWeb.Models.RequestModels;

public sealed class SendMultipleMessageRequest(List<int> sendToStaffIds, List<int> sendToCourierIds) : SendMessageBaseClass
{
    public List<int> SendToStaffIds { get; init; } = sendToStaffIds;
    public List<int> SendToCourierIds { get; init; } = sendToCourierIds;
}
