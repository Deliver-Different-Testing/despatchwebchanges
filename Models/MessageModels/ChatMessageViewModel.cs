using System;

namespace DespatchWeb.Models.MessageModels;

public class ChatMessageViewModel
{
    public int MessageId { get; init; }
    public int? SendToStaffId { get; init; }
    public int? SendFromStaffId { get; init; }
    public int? SendToCourierId { get; init; }
    public int? SendFromCourierId { get; init; }
    public string Message { get; init; }
    public DateTime MessageTime { get; init; }
    public bool Read { get; init; }
    public DateTime? ReadTime { get; init; }
    public bool Sent { get; init; }
    public bool IsSender { get; init; }
}