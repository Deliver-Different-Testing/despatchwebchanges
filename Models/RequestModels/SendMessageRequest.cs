using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class SendMessageRequest
{
    public int? SendToStaffId { get; set; }
    public int? SendToCourierId { get; set; }
    public string Message { get; set; }
    public int MessageType { get; set; }
}