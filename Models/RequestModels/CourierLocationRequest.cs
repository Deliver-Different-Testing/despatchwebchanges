namespace DespatchWeb.Models.RequestModels;

public class CourierLocationRequest
{
    public decimal MinLng { get; set; }

    public decimal MinLat { get; set; }

    public decimal MaxLng { get; set; }

    public decimal MaxLat { get; set; }

    public bool IsUsTenant { get; set; }
}
