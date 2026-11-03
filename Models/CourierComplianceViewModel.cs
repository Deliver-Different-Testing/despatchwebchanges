namespace DespatchWeb.Models;

public sealed class CourierComplianceViewModel
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Name { get; init; }
    public string ComplianceType { get; init; }
    public string ComplianceTypeKey { get; init; }
    public DateTimeOffset? ExpiryDate { get; init; }
    public string Status { get; init; }
    public int? DaysUntilExpiry { get; init; }
}
