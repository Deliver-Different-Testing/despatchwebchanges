namespace DespatchWeb.Models;

public sealed class BankingAndEmergency
{
    public bool EmergencyContact { get; init; }
    public string Bank { get; init; }
    public bool SecurityCheck { get; init; }
}
