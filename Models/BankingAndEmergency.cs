namespace DespatchWeb.Models;

public sealed class BankingAndEmergency
{
    public bool EmergencyContact { get; init; }
    public string EmergencyContactName { get; init; }
    public string EmergencyContactPhone { get; init; }
    public string EmergencyContactRelationship { get; init; }
    public string Bank { get; init; }
    public bool SecurityCheck { get; init; }
    public DateTime? SecurityCheckDate { get; init; }
}
