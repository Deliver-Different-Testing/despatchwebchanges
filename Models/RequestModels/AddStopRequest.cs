namespace DespatchWeb.Models.RequestModels;

public class AddStopRequest
{
    public int JobId { get; set; }
    public EditAddressDialogViewModel PickUpAddress { get; set; }
    public EditAddressDialogViewModel DeliveryAddress { get; set; }
}
