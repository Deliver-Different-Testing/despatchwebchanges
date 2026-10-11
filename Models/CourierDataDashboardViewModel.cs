namespace DespatchWeb.Models;

public sealed class CourierDataDashboardViewModel
{
    public int CourierId { get; init; }
    public BasicInformation BasicInformation { get; init; }
    public ContactInformation ContactInformation { get; init; }
    public VehicleInformation VehicleInformation { get; init; }
    public Compliance Compliance { get; init; }
    public BankingAndEmergency BankingAndEmergency { get; init; }
    public AdditionalInformation AdditionalInformation { get; init; }
}
