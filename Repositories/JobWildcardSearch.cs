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
            + (j.Barcode ?? "") + " "
            + (j.Gssconnote ?? "") + " "
            + (j.UcjbOurRef ?? "") + " "
            + (j.UcjbClientRefa ?? "") + " "
            + (j.UcjbClientRefb ?? "") + " "
            + (j.UcjbClientRefc ?? "") + " "
            + (j.TextRef1 ?? "") + " "
            + (j.TextRef2 ?? "") + " "
            + (j.TextRef3 ?? "") + " "
            + (j.TextRef4 ?? "") + " "
            + (j.ShopRef1 ?? "") + " "
            + (j.ShopRef2 ?? "") + " "
            + (j.ShopRef3 ?? "") + " "
            + (j.ShopRef4 ?? "") + " "
            + (j.ShopRef5 ?? "") + " "
            + (j.ClientItemIds ?? "") + " "
            + (j.StripeChargeId ?? "") + " "
            + (j.UcjbClientCode ?? "") + " "
            + (j.CustomJobName ?? "") + " "
            + (j.ScheduleName ?? "") + " "
            + (j.RunName ?? ""),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? "", pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? "") + " "
            + (j.UcjbContactPhone ?? "") + " "
            + (j.PickUpName ?? "") + " "
            + (j.PickupFromContact ?? "") + " "
            + (j.PickupFromPhone ?? "") + " "
            + (j.DeliverToContact ?? "") + " "
            + (j.DeliverToPhone ?? "") + " "
            + (j.UcjbPodname ?? "") + " "
            + (j.ProofOfDeliveryEmail ?? "") + " "
            + (j.ProofOfDeliveryMobile ?? "") + " "
            + (j.TrackingEmail ?? "") + " "
            + (j.TrackingMobile ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? "") + " "
            + (j.FromAddressStreetName ?? "") + " "
            + (j.FromAddressExtras ?? "") + " "
            + (j.FromAddressExtras2 ?? "") + " "
            + (j.PickupAddressLine1 ?? "") + " "
            + (j.PickupAddressLine2 ?? "") + " "
            + (j.PickupAddressLine3 ?? "") + " "
            + (j.PickupAddressLine4 ?? "") + " "
            + (j.PickupAddressLine5 ?? "") + " "
            + (j.PickupAddressLine6 ?? "") + " "
            + (j.PickupAddressLine7 ?? "") + " "
            + (j.PickupAddressLine8 ?? "") + " "
            + (j.UcjbFromNavigation.UcsuName ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? "") + " "
            + (j.ToAddressStreetName ?? "") + " "
            + (j.ToAddressExtras ?? "") + " "
            + (j.ToAddressExtras2 ?? "") + " "
            + (j.DeliveryAddressLine1 ?? "") + " "
            + (j.DeliveryAddressLine2 ?? "") + " "
            + (j.DeliveryAddressLine3 ?? "") + " "
            + (j.DeliveryAddressLine4 ?? "") + " "
            + (j.DeliveryAddressLine5 ?? "") + " "
            + (j.DeliveryAddressLine6 ?? "") + " "
            + (j.DeliveryAddressLine7 ?? "") + " "
            + (j.DeliveryAddressLine8 ?? "") + " "
            + (j.UcjbToNavigation.UcsuName ?? ""),
            pattern)
        // Matched one at a time rather than concatenated: the notes columns are nvarchar(4000)
        // each, and SQL Server types a concatenation of them as nvarchar(4000) too - anything
        // past the first long note would be silently truncated away before the LIKE ran.
        || EF.Functions.Like(j.UcjbNotes ?? "", pattern)
        || EF.Functions.Like(j.ClientNotes ?? "", pattern)
        || EF.Functions.Like(j.InternalNotes ?? "", pattern)
        || EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? "", pattern)
        || EF.Functions.Like(
            (j.UcjbToSpecial ?? "") + " "
            + (j.UcjbFlightDetails ?? "") + " "
            + (j.PickupCondition ?? ""),
            pattern)
        || j.TucJobNationwides.Any(nw => EF.Functions.Like(
            (nw.UcnwFlightNo ?? "") + " "
            + (nw.AircraftName ?? "") + " "
            + (nw.CarrierFsCode ?? "") + " "
            + (nw.DepartureAirportName ?? "") + " "
            + (nw.ArrivalAirportName ?? ""),
            pattern))
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? "") + " "
            + (cc.Contact.UcctSurname ?? ""),
            pattern));

    internal static Expression<Func<TucJobArchive, bool>> ArchivedJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.UcjbNumber + " "
            + (j.Barcode ?? "") + " "
            + (j.Gssconnote ?? "") + " "
            + (j.UcjbOurRef ?? "") + " "
            + (j.UcjbClientRefa ?? "") + " "
            + (j.UcjbClientRefb ?? "") + " "
            + (j.UcjbClientRefc ?? "") + " "
            + (j.TextRef1 ?? "") + " "
            + (j.TextRef2 ?? "") + " "
            + (j.TextRef3 ?? "") + " "
            + (j.TextRef4 ?? "") + " "
            + (j.ShopRef1 ?? "") + " "
            + (j.ShopRef2 ?? "") + " "
            + (j.ShopRef3 ?? "") + " "
            + (j.ShopRef4 ?? "") + " "
            + (j.ShopRef5 ?? "") + " "
            + (j.ClientItemIds ?? "") + " "
            + (j.StripeChargeId ?? "") + " "
            + (j.UcjbClientCode ?? "") + " "
            + (j.CustomJobName ?? "") + " "
            + (j.ScheduleName ?? "") + " "
            + (j.RunName ?? ""),
            pattern)
        // Kept out of the group above: connote is varchar(max), which would drag the whole
        // concatenation into a LOB expression
        || EF.Functions.Like(j.Connote ?? "", pattern)
        || EF.Functions.Like(
            (j.UcjbContact ?? "") + " "
            + (j.UcjbContactPhone ?? "") + " "
            + (j.PickUpName ?? "") + " "
            + (j.PickUpFromContact ?? "") + " "
            + (j.PickUpFromPhone ?? "") + " "
            + (j.DeliverToContact ?? "") + " "
            + (j.DeliverToPhone ?? "") + " "
            + (j.UcjbPodname ?? "") + " "
            + (j.ProofOfDeliveryEmail ?? "") + " "
            + (j.ProofOfDeliveryMobile ?? "") + " "
            + (j.TrackingEmail ?? "") + " "
            + (j.TrackingMobile ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.UcjbFromAddr ?? "") + " "
            + (j.FromAddressStreetName ?? "") + " "
            + (j.FromAddressExtras ?? "") + " "
            + (j.FromAddressExtras2 ?? "") + " "
            + (j.PickupAddressLine1 ?? "") + " "
            + (j.PickupAddressLine2 ?? "") + " "
            + (j.PickupAddressLine3 ?? "") + " "
            + (j.PickupAddressLine4 ?? "") + " "
            + (j.PickupAddressLine5 ?? "") + " "
            + (j.PickupAddressLine6 ?? "") + " "
            + (j.PickupAddressLine7 ?? "") + " "
            + (j.PickupAddressLine8 ?? "") + " "
            + (j.UcjbFromNavigation.UcsuName ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.UcjbToAddr ?? "") + " "
            + (j.ToAddressStreetName ?? "") + " "
            + (j.ToAddressExtras ?? "") + " "
            + (j.ToAddressExtras2 ?? "") + " "
            + (j.DeliveryAddressLine1 ?? "") + " "
            + (j.DeliveryAddressLine2 ?? "") + " "
            + (j.DeliveryAddressLine3 ?? "") + " "
            + (j.DeliveryAddressLine4 ?? "") + " "
            + (j.DeliveryAddressLine5 ?? "") + " "
            + (j.DeliveryAddressLine6 ?? "") + " "
            + (j.DeliveryAddressLine7 ?? "") + " "
            + (j.DeliveryAddressLine8 ?? "") + " "
            + (j.UcjbToNavigation.UcsuName ?? ""),
            pattern)
        // Matched one at a time rather than concatenated: the notes columns are nvarchar(4000)
        // each, and SQL Server types a concatenation of them as nvarchar(4000) too - anything
        // past the first long note would be silently truncated away before the LIKE ran.
        || EF.Functions.Like(j.UcjbNotes ?? "", pattern)
        || EF.Functions.Like(j.ClientNotes ?? "", pattern)
        || EF.Functions.Like(j.InternalNotes ?? "", pattern)
        || EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? "", pattern)
        || EF.Functions.Like(
            (j.UcjbToSpecial ?? "") + " "
            + (j.UcjbFlightDetails ?? "") + " "
            + (j.PickupCondition ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.Nationwide.UcnwFlightNo ?? "") + " "
            + (j.Nationwide.AircraftName ?? "") + " "
            + (j.Nationwide.CarrierFsCode ?? "") + " "
            + (j.Nationwide.DepartureAirportName ?? "") + " "
            + (j.Nationwide.ArrivalAirportName ?? ""),
            pattern)
        || j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
            (cc.Contact.UcctFirstname ?? "") + " "
            + (cc.Contact.UcctSurname ?? ""),
            pattern));

    internal static Expression<Func<TblBulkJob, bool>> BulkJobMatches(string pattern) => j =>
        EF.Functions.Like(
            j.JobNumber + " "
            + j.Barcode + " "
            + (j.OurRef ?? "") + " "
            + (j.ClientRefa ?? "") + " "
            + (j.ClientRefb ?? "") + " "
            + (j.OrderRef ?? "") + " "
            + (j.ShopRef1 ?? "") + " "
            + (j.ShopRef2 ?? "") + " "
            + (j.ShopRef3 ?? "") + " "
            + (j.ShopRef4 ?? "") + " "
            + (j.ShopRef5 ?? "") + " "
            + (j.ClientItemIds ?? "") + " "
            + (j.StripeChargeId ?? "") + " "
            + (j.ClientCode ?? "") + " "
            + (j.ScheduleName ?? "") + " "
            + (j.RunName ?? "") + " "
            + (j.Manifest ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.Contact ?? "") + " "
            + (j.PickupFromContact ?? "") + " "
            + (j.PickupFromPhone ?? "") + " "
            + (j.DeliverToContact ?? "") + " "
            + (j.DeliverToPhone ?? "") + " "
            + (j.ProofOfDeliveryEmail ?? "") + " "
            + (j.ProofOfDeliveryMobile ?? "") + " "
            + (j.TrackingEmail ?? "") + " "
            + (j.TrackingMobile ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.FromCompany ?? "") + " "
            + (j.FromAddress ?? "") + " "
            + (j.FromSuburb ?? "") + " "
            + (j.PickupAddressLine1 ?? "") + " "
            + (j.PickupAddressLine2 ?? "") + " "
            + (j.PickupAddressLine3 ?? "") + " "
            + (j.PickupAddressLine4 ?? "") + " "
            + (j.PickupAddressLine5 ?? "") + " "
            + (j.PickupAddressLine6 ?? "") + " "
            + (j.PickupAddressLine7 ?? "") + " "
            + (j.PickupAddressLine8 ?? ""),
            pattern)
        || EF.Functions.Like(
            (j.ToCompany ?? "") + " "
            + (j.ToAddress ?? "") + " "
            + (j.ToSuburb ?? "") + " "
            + (j.DeliveryAddressLine1 ?? "") + " "
            + (j.DeliveryAddressLine2 ?? "") + " "
            + (j.DeliveryAddressLine3 ?? "") + " "
            + (j.DeliveryAddressLine4 ?? "") + " "
            + (j.DeliveryAddressLine5 ?? "") + " "
            + (j.DeliveryAddressLine6 ?? "") + " "
            + (j.DeliveryAddressLine7 ?? "") + " "
            + (j.DeliveryAddressLine8 ?? ""),
            pattern)
        || EF.Functions.Like(j.Notes ?? "", pattern);
}
