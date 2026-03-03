using System;

namespace DespatchWeb.Models.MessageModels;

public class RecentMessageViewModel
{
    public int OtherPartyId { get; init; }
    public OtherMessagePartyType OtherPartyType { get; init; }
    public string OtherPartyName { get; init; }
    public string OtherPartyInitials { get; init; }
    public string OtherPartyStatus { get; init; }
    public int UnreadCount { get; init; }
    public string LastMessage { get; init; }
    public DateTime LastMessageTime { get; init; }
}

public enum OtherMessagePartyType
{
    Courier,
    Staff
}