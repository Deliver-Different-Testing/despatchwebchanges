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
    internal static Expression<Func<TucJob, bool>> LiveJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.UcjbNumber + " "
            + (j.Barcode ?? string.Empty) + " "
            + (j.Gssconnote ?? string.Empty) + " "
            + (j.UcjbOurRef ?? string.Empty) + " "
            + (j.UcjbClientRefa ?? string.Empty) + " "
            + (j.UcjbClientRefb ?? string.Empty) + " "
            + (j.UcjbClientRefc ?? string.Empty) + " "
            + (j.TextRef1 ?? string.Empty) + " "
            + (j.TextRef2 ?? string.Empty) + " "
            + (j.TextRef3 ?? string.Empty) + " "
            + (j.TextRef4 ?? string.Empty) + " "
            + (j.ShopRef1 ?? string.Empty) + " "
            + (j.ShopRef2 ?? string.Empty) + " "
            + (j.ShopRef3 ?? string.Empty) + " "
            + (j.ShopRef4 ?? string.Empty) + " "
            + (j.ShopRef5 ?? string.Empty) + " "
            + (j.ClientItemIds ?? string.Empty) + " "
            + (j.StripeChargeId ?? string.Empty) + " "
            + (j.UcjbClientCode ?? string.Empty) + " "
            + (j.CustomJobName ?? string.Empty) + " "
            + (j.ScheduleName ?? string.Empty) + " "
            + (j.RunName ?? string.Empty),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? string.Empty) + " "
            + (j.UcjbContactPhone ?? string.Empty) + " "
            + (j.PickUpName ?? string.Empty) + " "
            + (j.PickupFromContact ?? string.Empty) + " "
            + (j.PickupFromPhone ?? string.Empty) + " "
            + (j.DeliverToContact ?? string.Empty) + " "
            + (j.DeliverToPhone ?? string.Empty) + " "
            + (j.UcjbPodname ?? string.Empty) + " "
            + (j.ProofOfDeliveryEmail ?? string.Empty) + " "
            + (j.ProofOfDeliveryMobile ?? string.Empty) + " "
            + (j.TrackingEmail ?? string.Empty) + " "
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? string.Empty) + " "
            + (j.FromAddressStreetName ?? string.Empty) + " "
            + (j.FromAddressExtras ?? string.Empty) + " "
            + (j.FromAddressExtras2 ?? string.Empty) + " "
            + (j.PickupAddressLine1 ?? string.Empty) + " "
            + (j.PickupAddressLine2 ?? string.Empty) + " "
            + (j.PickupAddressLine3 ?? string.Empty) + " "
            + (j.PickupAddressLine4 ?? string.Empty) + " "
            + (j.PickupAddressLine5 ?? string.Empty) + " "
            + (j.PickupAddressLine6 ?? string.Empty) + " "
            + (j.PickupAddressLine7 ?? string.Empty) + " "
            + (j.PickupAddressLine8 ?? string.Empty) + " "
            + (j.UcjbFromNavigation.UcsuName ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? string.Empty) + " "
            + (j.ToAddressStreetName ?? string.Empty) + " "
            + (j.ToAddressExtras ?? string.Empty) + " "
            + (j.ToAddressExtras2 ?? string.Empty) + " "
            + (j.DeliveryAddressLine1 ?? string.Empty) + " "
            + (j.DeliveryAddressLine2 ?? string.Empty) + " "
            + (j.DeliveryAddressLine3 ?? string.Empty) + " "
            + (j.DeliveryAddressLine4 ?? string.Empty) + " "
            + (j.DeliveryAddressLine5 ?? string.Empty) + " "
            + (j.DeliveryAddressLine6 ?? string.Empty) + " "
            + (j.DeliveryAddressLine7 ?? string.Empty) + " "
            + (j.DeliveryAddressLine8 ?? string.Empty) + " "
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
            (j.UcjbToSpecial ?? string.Empty) + " "
            + (j.UcjbFlightDetails ?? string.Empty) + " "
            + (j.PickupCondition ?? string.Empty),
            pattern)
        || j.TucJobNationwides.Any(nw => EF.Functions.Like(
            (nw.UcnwFlightNo ?? string.Empty) + " "
            + (nw.AircraftName ?? string.Empty) + " "
            + (nw.CarrierFsCode ?? string.Empty) + " "
            + (nw.DepartureAirportName ?? string.Empty) + " "
            + (nw.ArrivalAirportName ?? string.Empty),
            pattern))
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? string.Empty) + " "
            + (cc.Contact.UcctSurname ?? string.Empty),
            pattern));

    internal static Expression<Func<TucJobArchive, bool>> ArchivedJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.UcjbNumber + " "
            + (j.Barcode ?? string.Empty) + " "
            + (j.Gssconnote ?? string.Empty) + " "
            + (j.UcjbOurRef ?? string.Empty) + " "
            + (j.UcjbClientRefa ?? string.Empty) + " "
            + (j.UcjbClientRefb ?? string.Empty) + " "
            + (j.UcjbClientRefc ?? string.Empty) + " "
            + (j.TextRef1 ?? string.Empty) + " "
            + (j.TextRef2 ?? string.Empty) + " "
            + (j.TextRef3 ?? string.Empty) + " "
            + (j.TextRef4 ?? string.Empty) + " "
            + (j.ShopRef1 ?? string.Empty) + " "
            + (j.ShopRef2 ?? string.Empty) + " "
            + (j.ShopRef3 ?? string.Empty) + " "
            + (j.ShopRef4 ?? string.Empty) + " "
            + (j.ShopRef5 ?? string.Empty) + " "
            + (j.ClientItemIds ?? string.Empty) + " "
            + (j.StripeChargeId ?? string.Empty) + " "
            + (j.UcjbClientCode ?? string.Empty) + " "
            + (j.CustomJobName ?? string.Empty) + " "
            + (j.ScheduleName ?? string.Empty) + " "
            + (j.RunName ?? string.Empty),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? string.Empty, pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? string.Empty) + " "
            + (j.UcjbContactPhone ?? string.Empty) + " "
            + (j.PickUpName ?? string.Empty) + " "
            + (j.PickUpFromContact ?? string.Empty) + " "
            + (j.PickUpFromPhone ?? string.Empty) + " "
            + (j.DeliverToContact ?? string.Empty) + " "
            + (j.DeliverToPhone ?? string.Empty) + " "
            + (j.UcjbPodname ?? string.Empty) + " "
            + (j.ProofOfDeliveryEmail ?? string.Empty) + " "
            + (j.ProofOfDeliveryMobile ?? string.Empty) + " "
            + (j.TrackingEmail ?? string.Empty) + " "
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? string.Empty) + " "
            + (j.FromAddressStreetName ?? string.Empty) + " "
            + (j.FromAddressExtras ?? string.Empty) + " "
            + (j.FromAddressExtras2 ?? string.Empty) + " "
            + (j.PickupAddressLine1 ?? string.Empty) + " "
            + (j.PickupAddressLine2 ?? string.Empty) + " "
            + (j.PickupAddressLine3 ?? string.Empty) + " "
            + (j.PickupAddressLine4 ?? string.Empty) + " "
            + (j.PickupAddressLine5 ?? string.Empty) + " "
            + (j.PickupAddressLine6 ?? string.Empty) + " "
            + (j.PickupAddressLine7 ?? string.Empty) + " "
            + (j.PickupAddressLine8 ?? string.Empty) + " "
            + (j.UcjbFromNavigation.UcsuName ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? string.Empty) + " "
            + (j.ToAddressStreetName ?? string.Empty) + " "
            + (j.ToAddressExtras ?? string.Empty) + " "
            + (j.ToAddressExtras2 ?? string.Empty) + " "
            + (j.DeliveryAddressLine1 ?? string.Empty) + " "
            + (j.DeliveryAddressLine2 ?? string.Empty) + " "
            + (j.DeliveryAddressLine3 ?? string.Empty) + " "
            + (j.DeliveryAddressLine4 ?? string.Empty) + " "
            + (j.DeliveryAddressLine5 ?? string.Empty) + " "
            + (j.DeliveryAddressLine6 ?? string.Empty) + " "
            + (j.DeliveryAddressLine7 ?? string.Empty) + " "
            + (j.DeliveryAddressLine8 ?? string.Empty) + " "
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
            (j.UcjbToSpecial ?? string.Empty) + " "
            + (j.UcjbFlightDetails ?? string.Empty) + " "
            + (j.PickupCondition ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.Nationwide.UcnwFlightNo ?? string.Empty) + " "
            + (j.Nationwide.AircraftName ?? string.Empty) + " "
            + (j.Nationwide.CarrierFsCode ?? string.Empty) + " "
            + (j.Nationwide.DepartureAirportName ?? string.Empty) + " "
            + (j.Nationwide.ArrivalAirportName ?? string.Empty),
            pattern)
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? string.Empty) + " "
            + (cc.Contact.UcctSurname ?? string.Empty),
            pattern));

    internal static Expression<Func<TblBulkJob, bool>> BulkJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.JobNumber + " "
            + j.Barcode + " "
            + (j.OurRef ?? string.Empty) + " "
            + (j.ClientRefa ?? string.Empty) + " "
            + (j.ClientRefb ?? string.Empty) + " "
            + (j.ClientRefc ?? string.Empty) + " "
            + (j.OrderRef ?? string.Empty) + " "
            + (j.ShopRef1 ?? string.Empty) + " "
            + (j.ShopRef2 ?? string.Empty) + " "
            + (j.ShopRef3 ?? string.Empty) + " "
            + (j.ShopRef4 ?? string.Empty) + " "
            + (j.ShopRef5 ?? string.Empty) + " "
            + (j.ClientItemIds ?? string.Empty) + " "
            + (j.StripeChargeId ?? string.Empty) + " "
            + (j.ClientCode ?? string.Empty) + " "
            + (j.ScheduleName ?? string.Empty) + " "
            + (j.RunName ?? string.Empty) + " "
            + (j.Manifest ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.Contact ?? string.Empty) + " "
            + (j.PickupFromContact ?? string.Empty) + " "
            + (j.PickupFromPhone ?? string.Empty) + " "
            + (j.DeliverToContact ?? string.Empty) + " "
            + (j.DeliverToPhone ?? string.Empty) + " "
            + (j.ProofOfDeliveryEmail ?? string.Empty) + " "
            + (j.ProofOfDeliveryMobile ?? string.Empty) + " "
            + (j.TrackingEmail ?? string.Empty) + " "
            + (j.TrackingMobile ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.FromCompany ?? string.Empty) + " "
            + (j.FromAddress ?? string.Empty) + " "
            + (j.FromSuburb ?? string.Empty) + " "
            + (j.PickupAddressLine1 ?? string.Empty) + " "
            + (j.PickupAddressLine2 ?? string.Empty) + " "
            + (j.PickupAddressLine3 ?? string.Empty) + " "
            + (j.PickupAddressLine4 ?? string.Empty) + " "
            + (j.PickupAddressLine5 ?? string.Empty) + " "
            + (j.PickupAddressLine6 ?? string.Empty) + " "
            + (j.PickupAddressLine7 ?? string.Empty) + " "
            + (j.PickupAddressLine8 ?? string.Empty),
            pattern)
        || EF.Functions.Like(
            (j.ToCompany ?? string.Empty) + " "
            + (j.ToAddress ?? string.Empty) + " "
            + (j.ToSuburb ?? string.Empty) + " "
            + (j.DeliveryAddressLine1 ?? string.Empty) + " "
            + (j.DeliveryAddressLine2 ?? string.Empty) + " "
            + (j.DeliveryAddressLine3 ?? string.Empty) + " "
            + (j.DeliveryAddressLine4 ?? string.Empty) + " "
            + (j.DeliveryAddressLine5 ?? string.Empty) + " "
            + (j.DeliveryAddressLine6 ?? string.Empty) + " "
            + (j.DeliveryAddressLine7 ?? string.Empty) + " "
            + (j.DeliveryAddressLine8 ?? string.Empty),
            pattern)
        || EF.Functions.Like(j.Notes ?? string.Empty, pattern);
}
