using System;
using DespatchWeb.Enums;

namespace DespatchWeb.Models.MessageModels;

public class RecentMessageViewModel
{
    public int CourierId { get; set; }
    public string CourierName {get;set;}
    public string Initials { get;set; }
    public string Status { get; set; }
    public int UnreadCount { get; set; }
    public string LastMessage { get; set; }
    public DateTime LastMessageTime {get;set;}
    public MessageDirection MessageDirection { get; set; }
}
