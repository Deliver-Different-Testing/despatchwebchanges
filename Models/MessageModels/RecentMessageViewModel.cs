using System;
using DespatchWeb.Enums;

namespace DespatchWeb.Models.MessageModels;

public class RecentMessageViewModel
{
    public int OtherPartyId { get; set; }
    public OtherMessagePartyType OtherPartyType { get; set; }
    public string OtherPartyName { get; set; }
    public string OtherPartyInitials { get; set; }
    public string OtherPartyStatus { get; set; }
    public int UnreadCount { get; set; }
    public string LastMessage { get; set; }
    public DateTime LastMessageTime { get; set; }
}

public enum OtherMessagePartyType
{
    Courier,
    Staff
}