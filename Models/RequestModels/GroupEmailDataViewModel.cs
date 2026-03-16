namespace DespatchWeb.Models.RequestModels;

public sealed class GroupEmailDataViewModel
{
    public List<int> CourierIds { get; init; } = [];
    public string Subject { get; init; }
    public string Body { get; init; }
}