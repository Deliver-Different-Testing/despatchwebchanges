namespace DespatchWeb.Models;

public class PrebookListViewModel
{
    public int Id { get; init; }
    public DateTimeOffset Booked { get; set; }
    public DateTimeOffset? NextDueTime { get; set; }
    public string Client { get; init; }
    public string CustomJobName { get; init; }
    public string JobNo { get; init; }
    public int? ClientId { get; init; }
    public string Courier { get; init; }
    public string Speed { get; init; }
    public AddressViewModel PickupAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
}