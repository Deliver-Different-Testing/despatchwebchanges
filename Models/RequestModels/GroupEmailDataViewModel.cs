using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class GroupEmailDataViewModel
{
    public List<int> CourierIds { get; set; } = [];
    public string Subject { get; set; }
    public string Body { get; set; }
}