namespace DespatchWeb.Models.Response;

public class JobCoordinateModel
{
    public int Id { get; set; }
    public string JobNo { get; set; }
    public decimal? PickupLatitude { get; set; }
    public decimal? PickupLongitude { get; set; }
    public decimal? DeliveryLatitude { get; set; }
    public decimal? DeliveryLongitude { get; set; }
    public int? StatusId { get; set; }
    public string StatusName { get; set; }
    public int ClientId { get; set; }
    public string ClientName { get; set; }
    public string Speed { get; set; }
    public string FromAddress { get; set; }
    public string ToAddress { get; set; }
}
