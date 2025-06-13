using System;

namespace DespatchWeb.Models.MessageModels;

public class ChatMessageViewModel
{
    public int MessageId { get; set; }
    public int StaffId { get; set; }
    public int CourierId { get; set; }
    public string Message { get; set; }
    public DateTime MessageTime { get; set; }
    public bool Read { get; set; }
    public DateTime? ReadTime { get; set; }
    public bool Sent { get; set; }
}
