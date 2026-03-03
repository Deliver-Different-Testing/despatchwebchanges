using System;

namespace DespatchWeb.Models;

/// <summary>
/// Internal DTO for client jobs report database projection.
/// Used as intermediate type before mapping to PerformanceSpendReportModel.
/// </summary>
internal class ClientJobsReportRow
{
    public string JobNumber { get; init; }
    public int? JobType { get; init; }
    public DateTime? Date { get; init; }
    public DateTime? Booked { get; init; }
    public string BookedBy { get; init; }
    public DateTime? PickedUpTime { get; init; }
    public DateTime? Delivered { get; init; }
    public string JobTypeDescription { get; init; }
    public int? Minutes { get; init; }
    public string PodName { get; init; }
    public string FromSuburb { get; init; }
    public string FromPostcode { get; init; }
    public string ToSuburb { get; init; }
    public string ToPostcode { get; init; }
    public string ToSuburbFromAddress { get; init; }
    public string FromAddr { get; init; }
    public string ToAddr { get; init; }
    public int? CourierId { get; init; }
    public bool? LatePickup { get; init; }
    public bool? LateDelivery { get; init; }
    public string ClientLegalName { get; init; }
    public string Speed { get; init; }
    public string Notes { get; init; }
    public decimal? Amount { get; init; }
    public string RefA { get; init; }
    public string RefB { get; init; }
    public string OurRef { get; init; }
    public decimal? RawBaseAmount { get; init; }
    public decimal? FuelSurchargeAmount { get; init; }
    public decimal? Weight { get; init; }
    public int? Size { get; init; }
    public int? Quantity { get; init; }
    public int? Year { get; init; }
    public int? Month { get; init; }
    public string CourierCode { get; init; }
    public string CourierName { get; init; }
    public int? InvoiceNo { get; init; }
    public bool? Locked { get; init; }
    public int? ClientId { get; init; }
    public string ClientNote { get; init; }
    public string AcceptedSpeed { get; init; }
}
