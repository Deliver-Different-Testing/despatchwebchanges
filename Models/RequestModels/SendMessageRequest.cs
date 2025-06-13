using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class SendMessageRequest
{
    public List<int> CourierIds { get; set; } = [];
    public string Message { get; set; }
    public int MessageType { get; set; }
}