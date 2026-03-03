namespace DespatchWeb.Models.RequestModels;

public class UpdateAddressRequest
{
    public int JobId { get; init; }
    public AddressViewModel Address { get; init; }
}
