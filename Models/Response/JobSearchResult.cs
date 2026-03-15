namespace DespatchWeb.Models.Response;

public class JobSearchResult
{
    public List<DispatchJobViewModel> Jobs { get; init; }
    public int TotalCount { get; init; }
    public bool HasMore { get; init; }
    public List<DispatchMapItem> MapItems { get; init; }
}

public class DispatchMapItem
{
    public int JobId { get; init; }
    public string JobNo { get; init; }
    public AddressViewModel PickupAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public Suggestion AssignedCourier { get; init; }
}