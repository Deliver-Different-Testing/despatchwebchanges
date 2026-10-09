namespace DespatchWeb.Interfaces;

/// <summary>
/// Summary of a user's pricing-related permissions.
/// </summary>
public class PricingPermissions
{
    public bool CanModifyPrices { get; set; }
    public bool CanBulkUpdate { get; set; }
    public bool CanRecalculate { get; set; }
    public bool CanSetBaseAmount { get; set; }
    public bool CanManageBreakdown { get; set; }
}
