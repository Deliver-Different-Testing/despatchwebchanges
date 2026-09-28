namespace DespatchWeb.Models.Response;

public sealed record JobSearchResult
{
    public IReadOnlyList<DispatchJobViewModel> Jobs { get; init; }
    public int TotalCount { get; init; }
    public bool HasMore { get; init; }
    public IReadOnlyList<DispatchMapItem> MapItems { get; init; }
}

public sealed record DispatchMapItem
{
    public int JobId { get; init; }
    public string JobNo { get; init; }
    public AddressViewModel PickupAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public Suggestion AssignedCourier { get; init; }
}