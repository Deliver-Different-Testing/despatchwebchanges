using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class SendMessageRequest : SendMessageBaseClass
{
    public int? SendToStaffId { get; set; }
    public int? SendToCourierId { get; set; }
}

public class SendMultipleMessageRequest(List<int> sendToStaffIds, List<int> sendToCourierIds) : SendMessageBaseClass
{
    public List<int> SendToStaffIds { get; set; } = sendToStaffIds;
    public List<int> SendToCourierIds { get; set; } = sendToCourierIds;
}

public class SendMessageBaseClass
{
    public string Message { get; set; }
    public int MessageType { get; set; }
}