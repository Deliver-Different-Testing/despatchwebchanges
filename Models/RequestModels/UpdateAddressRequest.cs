namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateAddressRequest
{
    public int JobId { get; init; }
    public AddressViewModel Address { get; init; }
}
