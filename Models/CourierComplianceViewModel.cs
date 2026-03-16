namespace DespatchWeb.Models;

public sealed class CourierComplianceViewModel
{
    public string Code { get; init; }
    public string Name { get; init; }
    public string ComplianceType { get; init; }
    public string ItemNumber { get; init; }
    public DateTimeOffset? ExpiryDate { get; init; }
    public string Status { get; init; }
    public string DaysUntilExpiry { get; init; }
}