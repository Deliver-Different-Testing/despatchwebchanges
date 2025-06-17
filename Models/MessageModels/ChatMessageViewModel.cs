using System;
using DespatchWeb.Enums;

namespace DespatchWeb.Models.MessageModels;

public class ChatMessageViewModel
{
    public int MessageId { get; set; }
    public int? SendToStaffId { get; set; }
    public int? SendFromStaffId { get; set; }
    public int? SendToCourierId { get; set; }
    public int? SendFromCourierId { get; set; }
    public string Message { get; set; }
    public DateTime MessageTime { get; set; }
    public bool Read { get; set; }
    public DateTime? ReadTime { get; set; }
    public bool Sent { get; set; }
    public bool IsSender { get; set; }
}