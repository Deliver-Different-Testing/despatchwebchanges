using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class JobSearchResult
{
    public List<DispatchJobViewModel> Jobs { get; set; }
    public int TotalCount { get; set; }
    public bool HasMore { get; set; }
    public List<DispatchMapItems> MapItems { get; set; }
}

public class DispatchMapItems
{
    public int JobId { get; set; }
    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }
}