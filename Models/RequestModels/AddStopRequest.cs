namespace DespatchWeb.Models.RequestModels;

public class AddStopRequest
{
    public int JobId { get; init; }
    public EditAddressDialogViewModel PickUpAddress { get; init; }
    public EditAddressDialogViewModel DeliveryAddress { get; init; }
}
