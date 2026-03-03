using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class GroupEmailDataViewModel
{
    public List<int> CourierIds { get; init; } = [];
    public string Subject { get; init; }
    public string Body { get; init; }
}