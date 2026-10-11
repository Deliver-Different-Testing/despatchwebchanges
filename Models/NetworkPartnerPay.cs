namespace DespatchWeb.Models;

/// <summary>
/// The tenant → network partner pay layer on a job: <c>tucJob.CourierPayment</c> (base) and
/// <c>tucJob.CourierFuel</c> (fuel passed through). This is the only money a logged-in network
/// partner is shown — never the tenant's revenue. See network-partner-pay-visibility.md §2.7 / §3.
/// </summary>
public sealed record NetworkPartnerPay(decimal CourierPayment, decimal CourierFuel)
{
    public decimal Total => CourierPayment + CourierFuel;
}
