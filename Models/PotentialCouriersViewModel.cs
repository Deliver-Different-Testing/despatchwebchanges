namespace DespatchWeb.Models;

public sealed class PotentialCouriersViewModel
{
    public int CourierId { get; init; }
    public string Code { get; init; }
    public string Reason { get; init; }
    public int RuleNumber { get; init; }
    public string FirstName { get; init; }
}