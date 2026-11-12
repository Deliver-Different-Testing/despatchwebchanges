using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Models;
using Microsoft.EntityFrameworkCore;

namespace DespatchWeb.Repositories;

/// <summary>
/// The agent's free-text search. A term may only match columns whose data class the caller holds: matching on a hidden
/// phone, note or POD name would let the agent infer the value from which jobs come back.
/// </summary>
internal static partial class JobWildcardSearch
{
    internal static Expression<Func<TucJob, bool>> LiveJobMatches(string pattern, JobWildcardColumns columns)
    {
        if (columns == JobWildcardColumns.All) return LiveJobMatches(pattern);

        List<Expression<Func<TucJob, bool>>> parts =
        [
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(j.Connote ?? string.Empty, pattern),
            j => EF.Functions.Like(
                (j.UcjbContact ?? string.Empty) + Space
                + (j.PickUpName ?? string.Empty) + Space
                + (j.PickupFromContact ?? string.Empty) + Space
                + (j.DeliverToContact ?? string.Empty),
                pattern),
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(j.UcjbFlightDetails ?? string.Empty, pattern),
            j => j.TucJobNationwides.Any(nw => EF.Functions.Like(
                (nw.UcnwFlightNo ?? string.Empty) + Space
                + (nw.AircraftName ?? string.Empty) + Space
                + (nw.CarrierFsCode ?? string.Empty) + Space
                + (nw.DepartureAirportName ?? string.Empty) + Space
                + (nw.ArrivalAirportName ?? string.Empty),
                pattern)),
            j => j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
                (cc.Contact.UcctFirstname ?? string.Empty) + Space
                + (cc.Contact.UcctSurname ?? string.Empty),
                pattern))
        ];

        if (columns.HasFlag(JobWildcardColumns.ContactDetails))
        {
            parts.Add(j => EF.Functions.Like(
                (j.UcjbContactPhone ?? string.Empty) + Space
                + (j.PickupFromPhone ?? string.Empty) + Space
                + (j.DeliverToPhone ?? string.Empty) + Space
                + (j.ProofOfDeliveryEmail ?? string.Empty) + Space
                + (j.ProofOfDeliveryMobile ?? string.Empty) + Space
                + (j.TrackingEmail ?? string.Empty) + Space
                + (j.TrackingMobile ?? string.Empty),
                pattern));
        }

        if (columns.HasFlag(JobWildcardColumns.PodName)) parts.Add(j => EF.Functions.Like(j.UcjbPodname ?? string.Empty, pattern));

        if (columns.HasFlag(JobWildcardColumns.Notes))
        {
            parts.Add(j => EF.Functions.Like(j.UcjbNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.ClientNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.InternalNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like((j.UcjbToSpecial ?? string.Empty) + Space + (j.PickupCondition ?? string.Empty), pattern));
        }

        return AnyOf(parts);
    }

    internal static Expression<Func<TucJobArchive, bool>> ArchivedJobMatches(string pattern, JobWildcardColumns columns)
    {
        if (columns == JobWildcardColumns.All) return ArchivedJobMatches(pattern);

        List<Expression<Func<TucJobArchive, bool>>> parts =
        [
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(j.Connote ?? string.Empty, pattern),
            j => EF.Functions.Like(
                (j.UcjbContact ?? string.Empty) + Space
                + (j.PickUpName ?? string.Empty) + Space
                + (j.PickUpFromContact ?? string.Empty) + Space
                + (j.DeliverToContact ?? string.Empty),
                pattern),
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(
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
                pattern),
            j => EF.Functions.Like(j.UcjbFlightDetails ?? string.Empty, pattern),
            j => EF.Functions.Like(
                (j.Nationwide.UcnwFlightNo ?? string.Empty) + Space
                + (j.Nationwide.AircraftName ?? string.Empty) + Space
                + (j.Nationwide.CarrierFsCode ?? string.Empty) + Space
                + (j.Nationwide.DepartureAirportName ?? string.Empty) + Space
                + (j.Nationwide.ArrivalAirportName ?? string.Empty),
                pattern),
            j => j.UcjbClient.TblClientContacts.Any(cc => EF.Functions.Like(
                (cc.Contact.UcctFirstname ?? string.Empty) + Space
                + (cc.Contact.UcctSurname ?? string.Empty),
                pattern))
        ];

        if (columns.HasFlag(JobWildcardColumns.ContactDetails))
        {
            parts.Add(j => EF.Functions.Like(
                (j.UcjbContactPhone ?? string.Empty) + Space
                + (j.PickUpFromPhone ?? string.Empty) + Space
                + (j.DeliverToPhone ?? string.Empty) + Space
                + (j.ProofOfDeliveryEmail ?? string.Empty) + Space
                + (j.ProofOfDeliveryMobile ?? string.Empty) + Space
                + (j.TrackingEmail ?? string.Empty) + Space
                + (j.TrackingMobile ?? string.Empty),
                pattern));
        }

        if (columns.HasFlag(JobWildcardColumns.PodName)) parts.Add(j => EF.Functions.Like(j.UcjbPodname ?? string.Empty, pattern));

        if (columns.HasFlag(JobWildcardColumns.Notes))
        {
            parts.Add(j => EF.Functions.Like(j.UcjbNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.ClientNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.InternalNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like(j.ItemNotReadyNotificationNotes ?? string.Empty, pattern));
            parts.Add(j => EF.Functions.Like((j.UcjbToSpecial ?? string.Empty) + Space + (j.PickupCondition ?? string.Empty), pattern));
        }

        return AnyOf(parts);
    }

    private static Expression<Func<T, bool>> AnyOf<T>(List<Expression<Func<T, bool>>> parts)
    {
        var parameter = Expression.Parameter(typeof(T), "j");
        var body = parts
            .Select(p => new ParameterSwap(p.Parameters[0], parameter).Visit(p.Body))
            .Aggregate(Expression.OrElse);
        return Expression.Lambda<Func<T, bool>>(body, parameter);
    }

    private sealed class ParameterSwap(ParameterExpression from, ParameterExpression to) : ExpressionVisitor
    {
        protected override Expression VisitParameter(ParameterExpression node) => node == from ? to : base.VisitParameter(node);
    }
}
