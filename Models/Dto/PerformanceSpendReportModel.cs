using System.ComponentModel.DataAnnotations.Schema;

namespace DespatchWeb.Models.Dto;

/// <summary>
/// Result model for REP_qryPerformance_Summary_PerformanceSpend stored procedure
/// All properties are strings to handle varying database types flexibly
/// Using Column attribute for Dapper to map column names with spaces
/// </summary>
public class PerformanceSpendReportModel
{
    [Column("Job Number")]
    public string? JobNumber { get; set; }

    public string? ucjbType { get; set; }

    [Column("Date")]
    public string? Date { get; set; }

    public string? Booked { get; set; }
    public string? BookedBy { get; set; }

    [Column("Picked up time")]
    public string? PickedUpTime { get; set; }

    public string? Delivered { get; set; }

    [Column("Total Time")]
    public string? TotalTime { get; set; }

    public string? DeliveryMins { get; set; }

    [Column("POD Name")]
    public string? PODName { get; set; }

    public string? Booker { get; set; }

    [Column("Achieved Speed")]
    public string? AchievedSpeed { get; set; }

    [Column("From")]
    public string? From { get; set; }

    [Column("From Postcode")]
    public string? FromPostcode { get; set; }

    [Column("To")]
    public string? To { get; set; }

    [Column("To Postcode")]
    public string? ToPostcode { get; set; }

    public string? ucjbFromAddr { get; set; }
    public string? Address { get; set; }
    public string? Courier { get; set; }

    [Column("Late Pickup")]
    public string? LatePickup { get; set; }

    [Column("Late Delivery")]
    public string? LateDelivery { get; set; }

    public string? ucclLegalName { get; set; }
    public string? ucjbSpeed { get; set; }
    public string? Notes { get; set; }

    [Column("Charge($) Excl GST")]
    public string? ChargeExclGST { get; set; }

    [Column("Ref A")]
    public string? RefA { get; set; }

    [Column("Ref B")]
    public string? RefB { get; set; }

    [Column("Urgent Ref")]
    public string? UrgentRef { get; set; }

    public string? Weight { get; set; }
    public string? Vehicle { get; set; }
    public string? Quantity { get; set; }
    public string? ucjbYear { get; set; }
    public string? ucjbMonth { get; set; }
    public string? Code { get; set; }
    public string? uccrName { get; set; }
    public string? ucjbInvoiceNo { get; set; }
    public string? ucjbLocked { get; set; }
    public string? ucjbClientID { get; set; }
    public string? ucclNote { get; set; }
    public string? Minutes { get; set; }
}
