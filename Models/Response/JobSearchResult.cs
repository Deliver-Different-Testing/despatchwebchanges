using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class JobSearchResult
{
    public List<DispatchJobViewModel> Jobs { get; set; }
    public int TotalCount { get; set; }
    public bool HasMore { get; set; }
    public List<DispatchMapItem> MapItems { get; set; }
}

public class DispatchMapItem
{
    public int JobId { get; set; }
    public string JobNo { get; set; }
    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
    public Suggestion AssignedCourier { get; set; }
}