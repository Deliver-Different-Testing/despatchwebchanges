using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

/// <summary>
/// The single definition of what the job search "General Search" box matches on, shared by the
/// live/archived job search, the CSV/Excel download, the price detail export and the bulk job
/// search so all four agree on which columns are searchable.
/// <para>
/// Columns are grouped by the value a user actually types - a reference, a person, an address, a
/// note - and each group is concatenated, so a term can span the parts of one composite value
/// (e.g. "12 Queen St Auckland" where the street and its suburb are separate columns).
/// </para>
/// <para>
/// Coordinate columns, the derived GSS tracking URL and internal flag columns are deliberately
/// left out: their contents only ever produce matches nobody was looking for. Everything else on
/// the job tables is searchable - see JobRepositoryWildcardSearchTests, which enumerates the
/// mapped columns from the EF model and fails when a new one is not covered here.
/// </para>
/// </summary>
internal static class JobWildcardSearch
{
    private const string Space = " ";
    
    internal static Expression<Func<TucJob, bool>> LiveJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.UcjbNumber + Space
            + (j.Barcode ?? string.Empty) + Space
            + (j.Gssconnote ?? string.Empty) + Space
            + (j.UcjbOurRef ?? string.Empty) + Space
            + (j.UcjbClientRefa ?? string.Empty) + Space
            + (j.UcjbClientRefb ?? string.Empty) + Space
            + (j.UcjbClientRefc ?? string.Empty) + Space
            + (j.TextRef1 ?? string.Empty) + Space
            + (j.TextRef2 ?? string.Empty) + Space
            + (j.TextRef3 ?? string.Empty) + Space
            + (j.TextRef4 ?? string.Empty) + Space
            + (j.ShopRef1 ?? string.Empty) + Space
            + (j.ShopRef2 ?? string.Empty) + Space
            + (j.ShopRef3 ?? string.Empty) + Space
            + (j.ShopRef4 ?? string.Empty) + Space
            + (j.ShopRef5 ?? string.Empty) + Space
            + (j.ClientItemIds ?? string.Empty) + Space
            + (j.StripeChargeId ?? string.Empty) + Space
            + (j.UcjbClientCode ?? string.Empty) + Space
            + (j.CustomJobName ?? string.Empty) + Space
            + (j.ScheduleName ?? string.Empty) + Space
            + (j.RunName ?? string.Empty),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? string.Empty) + Space
            + (j.UcjbContactPhone ?? string.Empty) + Space
            + (j.PickUpName ?? string.Empty) + Space
            + (j.PickupFromContact ?? string.Empty) + Space
            + (j.PickupFromPhone ?? string.Empty) + Space
            + (j.DeliverToContact ?? string.Empty) + Space
            + (j.DeliverToPhone ?? string.Empty) + Space
            + (j.UcjbPodname ?? string.Empty) + Space
            + (j.ProofOfDeliveryEmail ?? string.Empty) + Space
            + (j.ProofOfDeliveryMobile ?? string.Empty) + Space
            + (j.TrackingEmail ?? string.Empty) + Space
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? string.Empty) + Space
            + (j.FromAddressStreetName ?? string.Empty) + Space
            + (j.FromAddressExtras ?? string.Empty) + Space
            + (j.FromAddressExtras2 ?? string.Empty) + Space
            + (j.PickupAddressLine1 ?? string.Empty) + Space
            + (j.PickupAddressLine2 ?? string.Empty) + Space
            + (j.PickupAddressLine3 ?? string.Empty) + Space
            + (j.PickupAddressLine4 ?? string.Empty) + Space
            + (j.PickupAddressLine5 ?? string.Empty) + Space
            + (j.PickupAddressLine6 ?? string.Empty) + Space
            + (j.PickupAddressLine7 ?? string.Empty) + Space
            + (j.PickupAddressLine8 ?? string.Empty) + Space
            + (j.UcjbFromNavigation.UcsuName ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? string.Empty) + Space
            + (j.ToAddressStreetName ?? string.Empty) + Space
            + (j.ToAddressExtras ?? string.Empty) + Space
            + (j.ToAddressExtras2 ?? string.Empty) + Space
            + (j.DeliveryAddressLine1 ?? string.Empty) + Space
            + (j.DeliveryAddressLine2 ?? string.Empty) + Space
            + (j.DeliveryAddressLine3 ?? string.Empty) + Space
            + (j.DeliveryAddressLine4 ?? string.Empty) + Space
            + (j.DeliveryAddressLine5 ?? string.Empty) + Space
            + (j.DeliveryAddressLine6 ?? string.Empty) + Space
            + (j.DeliveryAddressLine7 ?? string.Empty) + Space
            + (j.DeliveryAddressLine8 ?? string.Empty) + Space
            + (j.UcjbToNavigation.UcsuName ?? string.Empty),
            pattern)
        // Matched one at a time rather than concatenated: the notes columns are nvarchar(4000)
        // each, and SQL Server types a concatenation of them as nvarchar(4000) too - anything
        // past the first long note would be silently truncated away before the LIKE ran.
        || EF.Functions.Like(j.UcjbNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.ClientNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.InternalNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbToSpecial ?? string.Empty) + Space
            + (j.UcjbFlightDetails ?? string.Empty) + Space
            + (j.PickupCondition ?? string.Empty),
            pattern)
        || j.TucJobNationwides.Any(nw => EF.Functions.Like(
            (nw.UcnwFlightNo ?? string.Empty) + Space
            + (nw.AircraftName ?? string.Empty) + Space
            + (nw.CarrierFsCode ?? string.Empty) + Space
            + (nw.DepartureAirportName ?? string.Empty) + Space
            + (nw.ArrivalAirportName ?? string.Empty),
            pattern))
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? string.Empty) + Space
            + (cc.Contact.UcctSurname ?? string.Empty),
            pattern));

    internal static Expression<Func<TucJobArchive, bool>> ArchivedJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.UcjbNumber + Space
            + (j.Barcode ?? string.Empty) + Space
            + (j.Gssconnote ?? string.Empty) + Space
            + (j.UcjbOurRef ?? string.Empty) + Space
            + (j.UcjbClientRefa ?? string.Empty) + Space
            + (j.UcjbClientRefb ?? string.Empty) + Space
            + (j.UcjbClientRefc ?? string.Empty) + Space
            + (j.TextRef1 ?? string.Empty) + Space
            + (j.TextRef2 ?? string.Empty) + Space
            + (j.TextRef3 ?? string.Empty) + Space
            + (j.TextRef4 ?? string.Empty) + Space
            + (j.ShopRef1 ?? string.Empty) + Space
            + (j.ShopRef2 ?? string.Empty) + Space
            + (j.ShopRef3 ?? string.Empty) + Space
            + (j.ShopRef4 ?? string.Empty) + Space
            + (j.ShopRef5 ?? string.Empty) + Space
            + (j.ClientItemIds ?? string.Empty) + Space
            + (j.StripeChargeId ?? string.Empty) + Space
            + (j.UcjbClientCode ?? string.Empty) + Space
            + (j.CustomJobName ?? string.Empty) + Space
            + (j.ScheduleName ?? string.Empty) + Space
            + (j.RunName ?? string.Empty),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? string.Empty) + Space
            + (j.UcjbContactPhone ?? string.Empty) + Space
            + (j.PickUpName ?? string.Empty) + Space
            + (j.PickUpFromContact ?? string.Empty) + Space
            + (j.PickUpFromPhone ?? string.Empty) + Space
            + (j.DeliverToContact ?? string.Empty) + Space
            + (j.DeliverToPhone ?? string.Empty) + Space
            + (j.UcjbPodname ?? string.Empty) + Space
            + (j.ProofOfDeliveryEmail ?? string.Empty) + Space
            + (j.ProofOfDeliveryMobile ?? string.Empty) + Space
            + (j.TrackingEmail ?? string.Empty) + Space
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? string.Empty) + Space
            + (j.FromAddressStreetName ?? string.Empty) + Space
            + (j.FromAddressExtras ?? string.Empty) + Space
            + (j.FromAddressExtras2 ?? string.Empty) + Space
            + (j.PickupAddressLine1 ?? string.Empty) + Space
            + (j.PickupAddressLine2 ?? string.Empty) + Space
            + (j.PickupAddressLine3 ?? string.Empty) + Space
            + (j.PickupAddressLine4 ?? string.Empty) + Space
            + (j.PickupAddressLine5 ?? string.Empty) + Space
            + (j.PickupAddressLine6 ?? string.Empty) + Space
            + (j.PickupAddressLine7 ?? string.Empty) + Space
            + (j.PickupAddressLine8 ?? string.Empty) + Space
            + (j.UcjbFromNavigation.UcsuName ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? string.Empty) + Space
            + (j.ToAddressStreetName ?? string.Empty) + Space
            + (j.ToAddressExtras ?? string.Empty) + Space
            + (j.ToAddressExtras2 ?? string.Empty) + Space
            + (j.DeliveryAddressLine1 ?? string.Empty) + Space
            + (j.DeliveryAddressLine2 ?? string.Empty) + Space
            + (j.DeliveryAddressLine3 ?? string.Empty) + Space
            + (j.DeliveryAddressLine4 ?? string.Empty) + Space
            + (j.DeliveryAddressLine5 ?? string.Empty) + Space
            + (j.DeliveryAddressLine6 ?? string.Empty) + Space
            + (j.DeliveryAddressLine7 ?? string.Empty) + Space
            + (j.DeliveryAddressLine8 ?? string.Empty) + Space
            + (j.UcjbToNavigation.UcsuName ?? string.Empty),
            pattern)
        // Matched one at a time rather than concatenated: the notes columns are nvarchar(4000)
        // each, and SQL Server types a concatenation of them as nvarchar(4000) too - anything
        // past the first long note would be silently truncated away before the LIKE ran.
        || EF.Functions.Like(j.UcjbNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.ClientNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.InternalNotes ?? string.Empty, pattern)
        || EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbToSpecial ?? string.Empty) + Space
            + (j.UcjbFlightDetails ?? string.Empty) + Space
            + (j.PickupCondition ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.Nationwide.UcnwFlightNo ?? string.Empty) + Space
            + (j.Nationwide.AircraftName ?? string.Empty) + Space
            + (j.Nationwide.CarrierFsCode ?? string.Empty) + Space
            + (j.Nationwide.DepartureAirportName ?? string.Empty) + Space
            + (j.Nationwide.ArrivalAirportName ?? string.Empty),
            pattern)
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? string.Empty) + Space
            + (cc.Contact.UcctSurname ?? string.Empty),
            pattern));

    internal static Expression<Func<TblBulkJob, bool>> BulkJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.JobNumber + Space
            + j.Barcode + Space
            + (j.OurRef ?? string.Empty) + Space
            + (j.ClientRefa ?? string.Empty) + Space
            + (j.ClientRefb ?? string.Empty) + Space
            + (j.ClientRefc ?? string.Empty) + Space
            + (j.OrderRef ?? string.Empty) + Space
            + (j.ShopRef1 ?? string.Empty) + Space
            + (j.ShopRef2 ?? string.Empty) + Space
            + (j.ShopRef3 ?? string.Empty) + Space
            + (j.ShopRef4 ?? string.Empty) + Space
            + (j.ShopRef5 ?? string.Empty) + Space
            + (j.ClientItemIds ?? string.Empty) + Space
            + (j.StripeChargeId ?? string.Empty) + Space
            + (j.ClientCode ?? string.Empty) + Space
            + (j.ScheduleName ?? string.Empty) + Space
            + (j.RunName ?? string.Empty) + Space
            + (j.Manifest ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.Contact ?? string.Empty) + Space
            + (j.PickupFromContact ?? string.Empty) + Space
            + (j.PickupFromPhone ?? string.Empty) + Space
            + (j.DeliverToContact ?? string.Empty) + Space
            + (j.DeliverToPhone ?? string.Empty) + Space
            + (j.ProofOfDeliveryEmail ?? string.Empty) + Space
            + (j.ProofOfDeliveryMobile ?? string.Empty) + Space
            + (j.TrackingEmail ?? string.Empty) + Space
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.FromCompany ?? string.Empty) + Space
            + (j.FromAddress ?? string.Empty) + Space
            + (j.FromSuburb ?? string.Empty) + Space
            + (j.PickupAddressLine1 ?? string.Empty) + Space
            + (j.PickupAddressLine2 ?? string.Empty) + Space
            + (j.PickupAddressLine3 ?? string.Empty) + Space
            + (j.PickupAddressLine4 ?? string.Empty) + Space
            + (j.PickupAddressLine5 ?? string.Empty) + Space
            + (j.PickupAddressLine6 ?? string.Empty) + Space
            + (j.PickupAddressLine7 ?? string.Empty) + Space
            + (j.PickupAddressLine8 ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.ToCompany ?? string.Empty) + Space
            + (j.ToAddress ?? string.Empty) + Space
            + (j.ToSuburb ?? string.Empty) + Space
            + (j.DeliveryAddressLine1 ?? string.Empty) + Space
            + (j.DeliveryAddressLine2 ?? string.Empty) + Space
            + (j.DeliveryAddressLine3 ?? string.Empty) + Space
            + (j.DeliveryAddressLine4 ?? string.Empty) + Space
            + (j.DeliveryAddressLine5 ?? string.Empty) + Space
            + (j.DeliveryAddressLine6 ?? string.Empty) + Space
            + (j.DeliveryAddressLine7 ?? string.Empty) + Space
            + (j.DeliveryAddressLine8 ?? string.Empty),
            pattern)
        || EF.Functions.Like(j.Notes ?? string.Empty, pattern);
}
