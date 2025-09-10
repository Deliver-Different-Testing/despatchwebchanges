namespace DespatchWeb.Models.RequestModels;

public class UpdateAddressRequest
{
    public int JobId { get; set; }
    public AddressViewModel Address { get; set; }
}
