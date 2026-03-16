using System.ComponentModel.DataAnnotations.Schema;

namespace DespatchWeb.Models.Dto;

/// <summary>
/// Result model for REP_qryPerformance_Summary_PerformanceSpend stored procedure
/// All properties are strings to handle varying database types flexibly
/// Using Column attribute for Dapper to map column names with spaces
/// </summary>
public sealed class PerformanceSpendReportModel
{
    [Column("Job Number")]
    public string JobNumber { get; init; }

    public string UcjbType { get; init; }

    [Column("Date")]
    public string Date { get; init; }

    public string Booked { get; init; }
    public string BookedBy { get; init; }

    [Column("Picked up time")]
    public string PickedUpTime { get; init; }

    public string Delivered { get; init; }

    [Column("Total Time")]
    public string TotalTime { get; init; }

    public string DeliveryMins { get; init; }

    [Column("POD Name")]
    public string PodName { get; init; }

    public string Booker { get; init; }

    [Column("Achieved Speed")]
    public string AchievedSpeed { get; init; }

    [Column("From")]
    public string From { get; init; }

    [Column("From Postcode")]
    public string FromPostcode { get; init; }

    [Column("To")]
    public string To { get; init; }

    [Column("To Postcode")]
    public string ToPostcode { get; init; }

    public string UcjbFromAddr { get; init; }
    public string Address { get; init; }
    public string Courier { get; init; }

    [Column("Late Pickup")]
    public string LatePickup { get; init; }

    [Column("Late Delivery")]
    public string LateDelivery { get; init; }

    public string UcclLegalName { get; init; }
    public string UcjbSpeed { get; init; }
    public string Notes { get; init; }

    [Column("Charge($) Excl GST")]
    public string ChargeExclGst { get; init; }

    [Column("Ref A")]
    public string RefA { get; init; }

    [Column("Ref B")]
    public string RefB { get; init; }

    [Column("Urgent Ref")]
    public string UrgentRef { get; init; }

    public string Weight { get; init; }
    public string Vehicle { get; init; }
    public string Quantity { get; init; }
    public string UcjbYear { get; init; }
    public string UcjbMonth { get; init; }
    public string Code { get; init; }
    public string UccrName { get; init; }
    public string UcjbInvoiceNo { get; init; }
    public string UcjbLocked { get; init; }
    public string UcjbClientId { get; init; }
    public string UcclNote { get; init; }
    public string Minutes { get; init; }
    public decimal? RawBaseAmount { get; init; }
    public decimal? FuelSurchargeAmount { get; init; }
}
