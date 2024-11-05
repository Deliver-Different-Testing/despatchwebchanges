namespace DespatchWeb.Models.RequestModels;

public class UpdateAddressRequest
{
    public int JobId { get; set; }
    public decimal Rate { get; set; }
    public string DespatcherName { get; set; }
}

public class UpdateAddressRequestNz : UpdateAddressRequest
{
    public string Address { get; set; }
    public int SuburbId { get; set; }
    public bool Cbd { get; set; }
    public decimal Latitude { get; set; }
    public decimal Longitude { get; set; }
}

public class UpdateAddressRequestUs : UpdateAddressRequest
{
    public AddressViewModel Address { get; set; }
}
