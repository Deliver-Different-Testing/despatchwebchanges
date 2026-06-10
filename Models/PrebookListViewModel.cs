using DespatchWeb.Enums;

namespace DespatchWeb.Models;

public sealed class PrebookListViewModel
{
    public int Id { get; init; }
    public DateTimeOffset Booked { get; set; }
    public DateTimeOffset? NextDueTime { get; set; }
    public string Client { get; init; }
    public string CustomJobName { get; init; }
    public string JobNo { get; init; }
    public int? ClientId { get; init; }
    public string Courier { get; init; }
    public string Speed { get; init; }
    public AddressViewModel PickupAddress { get; init; }
    public AddressViewModel DeliveryAddress { get; init; }
    public int? RouteId { get; init; }
    public string RouteName { get; init; }

    // Three-state recurring operational mode — surfaced to the React UI
    // for the toolbar's Active/Manual/Inactive filter and to the CSV
    // export so operators can audit which rows are excluded from the
    // nightly auto-materialiser.
    public RecurringMode RecurringMode { get; init; }

    // Pricing trio for CSV-side audit of fuel-drift behaviour. Headline
    // remains the visible total; RawBaseAmount is the commercial anchor
    // recurring uses to recompute fuel at materialisation time.
    public decimal? RawBaseAmount { get; init; }
    public decimal? FuelSurchargeAmount { get; init; }
    public decimal? UcbkAmount { get; init; }

    // True when this row is a child in a parent/child booking family
    // (BookingParentID points to a different ucbkID). Drives the
    // Insert-to-live menu visibility — only parents and standalones can
    // initiate a Manual push.
    public bool IsChild { get; init; }
}