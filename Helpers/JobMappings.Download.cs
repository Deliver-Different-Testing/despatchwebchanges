using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Extensions;
using DespatchWeb.Models;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
    #region POD Search Download Mappings

    /// <summary>
    /// Projects TucJob (live jobs) directly to JobDownloadModel.
    /// Amount uses parent pricing breakdown sum if available, else job's own sum, else UcjbAmount.
    /// Matches the calculation logic used in JobArchiveMapping for consistency.
    /// </summary>
    public static readonly Expression<Func<TucJob, JobDownloadModel>> LiveJobDownloadMapping =
        j => new JobDownloadModel
        {
            Id = j.UcjbId,
            ParentId = j.ParentId,
            JobNumber = j.UcjbNumber,
            CustomerName = j.UcjbClient != null ? j.UcjbClient.UcclName : null,
            BookDate = j.UcjbDate.CombineWithTime(j.UcjbTime),
            PickedUpDate = j.PickUpTime,
            DeliveredDate = j.UcjbComplTime,
            Amount = j.UcjbAmount ?? 0,
            Fuel = j.FuelSurchargeAmount,
            Ppd = j.PpdexclusiveAmount,
            AgentAirlineName = j.TucJobNationwides.Select(nw => nw.UcnwAirlineName).FirstOrDefault()
                               ?? (j.Agent != null ? j.Agent.UcagName : null),
            AWB = j.TucJobNationwides.Select(nw => nw.UcnwFlightNo).FirstOrDefault(),
            CourierPayment = j.CourierPayment,
            CourierFuel = j.CourierFuel,
            CourierBonus = j.CourierBonus,
            Quantity = j.UcjbQty,
            Weight = j.UcjbWeight,
            Size = j.UcjbSize,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            PickupAddressLine1 = j.PickupAddressLine1,
            PickupAddressLine2 = j.PickupAddressLine2,
            PickupAddressLine3 = j.PickupAddressLine3,
            PickupAddressLine4 = j.PickupAddressLine4,
            PickupAddressLine5 = j.PickupAddressLine5,
            PickupAddressLine6 = j.PickupAddressLine6,
            PickupAddressLine7 = j.PickupAddressLine7,
            PickupAddressLine8 = j.PickupAddressLine8,
            DeliveryAddressLine1 = j.DeliveryAddressLine1,
            DeliveryAddressLine2 = j.DeliveryAddressLine2,
            DeliveryAddressLine3 = j.DeliveryAddressLine3,
            DeliveryAddressLine4 = j.DeliveryAddressLine4,
            DeliveryAddressLine5 = j.DeliveryAddressLine5,
            DeliveryAddressLine6 = j.DeliveryAddressLine6,
            DeliveryAddressLine7 = j.DeliveryAddressLine7,
            DeliveryAddressLine8 = j.DeliveryAddressLine8,
            ClientReferenceA = j.UcjbClientRefa,
            ClientReferenceB = j.UcjbClientRefb,
            ClientReferenceC = j.UcjbClientRefc,
            InvoiceNumber = null,
            InvoiceDate = null,
            IsArchived = false,
            LoggedInContact = j.LoggedInContact != null
                ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
                : null,
            RawBaseAmount = j.RawBaseAmount,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null
        };

    /// <summary>
    /// Projects TucJobArchive (archived jobs) directly to JobDownloadModel.
    /// Amount uses parent pricing breakdown sum if available, else job's own sum, else UcjbAmount.
    /// Matches the calculation logic used in JobArchiveMapping for consistency.
    /// </summary>
    public static readonly Expression<Func<TucJobArchive, JobDownloadModel>> ArchivedJobDownloadMapping =
        j => new JobDownloadModel
        {
            Id = j.UcjbId,
            ParentId = j.ParentId,
            JobNumber = j.UcjbNumber,
            CustomerName = j.UcjbClient != null ? j.UcjbClient.UcclName : null,
            BookDate = j.UcjbDate.HasValue ? j.UcjbDate.Value.CombineWithTime(j.UcjbTime) : default,
            PickedUpDate = j.PickUpTime,
            DeliveredDate = j.UcjbComplTime,
            Amount = j.UcjbAmount ?? 0,
            Fuel = j.FuelSurchargeAmount,
            Ppd = j.PpdexclusiveAmount,
            AgentAirlineName = j.Agent != null ? j.Agent.UcagName : null,
            AWB = null,
            CourierPayment = j.CourierPayment,
            CourierFuel = j.CourierFuel,
            CourierBonus = j.CourierBonus,
            Quantity = j.UcjbQty,
            Weight = j.UcjbWeight,
            Size = j.UcjbSize,
            StatusName = j.UcjbStatusNavigation != null ? j.UcjbStatusNavigation.UcjsName : null,
            PickupAddressLine1 = j.PickupAddressLine1,
            PickupAddressLine2 = j.PickupAddressLine2,
            PickupAddressLine3 = j.PickupAddressLine3,
            PickupAddressLine4 = j.PickupAddressLine4,
            PickupAddressLine5 = j.PickupAddressLine5,
            PickupAddressLine6 = j.PickupAddressLine6,
            PickupAddressLine7 = j.PickupAddressLine7,
            PickupAddressLine8 = j.PickupAddressLine8,
            DeliveryAddressLine1 = j.DeliveryAddressLine1,
            DeliveryAddressLine2 = j.DeliveryAddressLine2,
            DeliveryAddressLine3 = j.DeliveryAddressLine3,
            DeliveryAddressLine4 = j.DeliveryAddressLine4,
            DeliveryAddressLine5 = j.DeliveryAddressLine5,
            DeliveryAddressLine6 = j.DeliveryAddressLine6,
            DeliveryAddressLine7 = j.DeliveryAddressLine7,
            DeliveryAddressLine8 = j.DeliveryAddressLine8,
            ClientReferenceA = j.UcjbClientRefa,
            ClientReferenceB = j.UcjbClientRefb,
            ClientReferenceC = j.UcjbClientRefc,
            InvoiceNumber = j.UcjbInvoiceNo,
            InvoiceDate = j.Invoice != null ? j.Invoice.Created : null,
            IsArchived = true,
            LoggedInContact = j.LoggedInContact != null
                ? j.LoggedInContact.UcctFirstname + " " + j.LoggedInContact.UcctSurname
                : null,
            RawBaseAmount = j.RawBaseAmount,
            CourierCode = j.UcjbCourier != null ? j.UcjbCourier.Code : null
        };

    #endregion
}
