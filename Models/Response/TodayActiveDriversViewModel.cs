namespace DespatchWeb.Models.Response;

public sealed record TodayActiveDriversViewModel
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Name { get; init; }
    public string Fleet { get; init; }
    public DateTimeOffset LoginTime { get; init; }
    public DateTimeOffset? LogoutTime { get; init; }
    public string Duration { get; init; }
    public int Deliveries { get; init; }
    public string Status { get; init; }
}