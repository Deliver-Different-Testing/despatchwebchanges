using System;

namespace DespatchWeb.Models;

public class CourierComplianceViewModel
{
    public string Code { get; set; }
    public string Name { get; set; }
    public string ComplianceType { get; set; }
    public string ItemNumber { get; set; }
    public DateTimeOffset? ExpiryDate { get; set; }
    public string Status { get; set; }
    public string DaysUntilExpiry { get; set; }
}