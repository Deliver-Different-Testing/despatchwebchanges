using System;

namespace DespatchWeb.Models.Response;

public class TodayActiveDriversViewModel
{
    public int CourierId { get; set; }
    public string Code { get; set; }
    public string Name { get; set; }
    public string Fleet { get; set; }
    public DateTimeOffset LoginTime { get; set; }
    public DateTimeOffset? LogoutTime { get; set; }
    public string Duration { get; set; }
    public int Deliveries { get; set; }
    public string Status { get; set; }
}