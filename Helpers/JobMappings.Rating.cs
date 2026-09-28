using System.Linq.Expressions;
using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Models.Dto;

namespace DespatchWeb.Helpers;

public static partial class JobMappings
{
    /// <summary>
    /// Maps a live TucJob to JobRatingDetailsDto (US tenant rating).
    /// </summary>
    public static Expression<Func<TucJob, JobRatingDetailsDto>> JobRatingUsMapping() =>
        job => new JobRatingDetailsDto
        {
            JobId = job.UcjbId,
            ClientId = job.UcjbClientId,
            FromId = job.UcjbFrom,
            ToId = job.UcjbTo,
            SpeedId = job.UcjbSpeed,
            IsPedal = job.UcjbCbd,
            IsVan = job.UcjbVan,
            IsReturnJob = job.UcjbReturn,
            Weight = job.UcjbWeight,
            SizeId = job.UcjbSize,
            IncludeFuelSurcharge = false,
            IsDirect = job.Direct,
            AcceptedJobTypeId = job.AcceptedJobTypeId,
            OurRef = job.UcjbOurRef,
            RefA = job.UcjbClientRefa,
            RefB = job.UcjbClientRefb,
            Quantity = job.UcjbQty ?? 1,
            BookedDate = job.UcjbDate,

            PickupLat = job.PickUpLatitude ?? 0,
            PickupLong = job.PickUpLongitude ?? 0,
            DeliveryLat = job.DeliveryLatitude ?? 0,
            DeliveryLong = job.DeliveryLongitude ?? 0,

            FromZip = job.PickupAddressLine7,
            ToZip = job.DeliveryAddressLine7,
            DangerousGoods = job.Dgdocument ?? false,
            TotalPallets = job.TucJobItemJobs.Count,
            ExtraStopOffs = 0,
            DryIceWeight = job.DryIceWeight ?? 0,
            PickupWaitTime = job.WaitedPickUp ?? 0,
            DeliveryWaitTime = job.WaitedDelivery ?? 0,

            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
            ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

            ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
            Cubic = job.TucJobItemJobs.Sum(i => i.Cubic),
            IsManuallyRated = job.RatedManually,
            CalculateDimsOncePerJob = job.DimensionsType == 2
        };

    /// <summary>
    /// Maps a live TucJob to JobRatingDetailsDtoNz (NZ tenant rating).
    /// </summary>
    public static Expression<Func<TucJob, JobRatingDetailsDtoNz>> JobRatingNzMapping() =>
        job => new JobRatingDetailsDtoNz
        {
            JobId = job.UcjbId,
            ClientId = job.UcjbClientId,
            FromId = job.UcjbFrom,
            ToId = job.UcjbTo,
            SpeedId = job.UcjbSpeed,
            IsPedal = job.UcjbCbd,
            IsVan = job.UcjbVan,
            IsReturnJob = job.UcjbReturn,
            Weight = job.UcjbWeight,
            SizeId = job.UcjbSize,
            IncludeFuelSurcharge = false,
            IsDirect = job.Direct,
            AcceptedJobTypeId = job.AcceptedJobTypeId,
            OurRef = job.UcjbOurRef,
            RefA = job.UcjbClientRefa,
            RefB = job.UcjbClientRefb,
            Quantity = job.UcjbQty ?? 1,
            BookedDate = new DateTime(
                job.UcjbDate.Year,
                job.UcjbDate.Month,
                job.UcjbDate.Day,
                job.UcjbTime.HasValue ? job.UcjbTime.Value.Hour : 0,
                job.UcjbTime.HasValue ? job.UcjbTime.Value.Minute : 0,
                job.UcjbTime.HasValue ? job.UcjbTime.Value.Second : 0
            ),

            PickupLat = job.PickUpLatitude ?? 0,
            PickupLong = job.PickUpLongitude ?? 0,
            DeliveryLat = job.DeliveryLatitude ?? 0,
            DeliveryLong = job.DeliveryLongitude ?? 0,

            DangerousGoods = job.Dgdocument ?? false,
            TotalPallets = job.TucJobItemJobs.Count,
            ExtraStopOffs = 0,
            DryIceWeight = job.DryIceWeight ?? 0,
            PickupWaitTime = job.WaitedPickUp ?? 0,
            DeliveryWaitTime = job.WaitedDelivery ?? 0,

            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
            ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

            ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
            Cubic = job.TucJobItemJobs.Sum(i => i.Cubic),
            IsManuallyRated = job.RatedManually,
            CalculateDimsOncePerJob = job.DimensionsType == 2,
            IsPrebook = job.IsRecurringJob,
            BulkScheduleId = job.ScheduleId,
            CreatedTime = job.CreatedTime,

            FromCompanyName = job.PickupAddressLine1,
            FromBuildingName = job.PickupAddressLine2,
            FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
            FromSuburb = job.PickupAddressLine5,
            FromCity = job.PickupAddressLine6,
            FromState = null,
            FromPostCode = job.PickupAddressLine7,
            FromCountryCode = job.PickupAddressLine8,

            ToCompanyName = job.DeliveryAddressLine1,
            ToBuildingName = job.DeliveryAddressLine2,
            ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
            ToSuburb = job.DeliveryAddressLine5,
            ToCity = job.DeliveryAddressLine6,
            ToState = null,
            ToPostCode = job.DeliveryAddressLine7,
            ToCountryCode = job.DeliveryAddressLine8,

            Packages = job.TucJobItemJobs.Select(item => new PackageDetailsDto
            {
                Name = item.Notes,
                Length = item.Length,
                Width = item.Depth,
                Height = item.Height,
                Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                Kg = item.Weight,
                Type = null,
                PackageCode = null,
                Units = item.Items
            }).ToList(),

            PickupTailLift = job.TucJobItemJobs.Any(i => i.Pu == true),
            DropoffTailLift = job.TucJobItemJobs.Any(i => i.Do == true),
            PrivateRes = job.TucJobItemJobs.Any(i => i.PrivateRes == true),
            HasDgDocuments = job.Dgdocument,
            TruckStartTime = job.TruckStartTime.HasValue ? job.TruckStartTime.ToString() : null,
            TruckHours = job.TruckHours.HasValue ? (int)job.TruckHours : null,
            JobType = JobType.Active,
            IsTruck = job.Truck ?? false
        };

    /// <summary>
    /// Maps a TucJobArchive to JobRatingDetailsDtoNz (NZ tenant rating, archived jobs).
    /// </summary>
    public static Expression<Func<TucJobArchive, JobRatingDetailsDtoNz>> JobRatingNzArchiveMapping() =>
        job => new JobRatingDetailsDtoNz
        {
            JobId = job.UcjbId,
            ClientId = job.UcjbClientId,
            FromId = job.UcjbFrom,
            ToId = job.UcjbTo,
            SpeedId = job.UcjbSpeed,
            IsPedal = job.UcjbCbd,
            IsVan = job.UcjbVan,
            IsReturnJob = job.UcjbReturn,
            Weight = job.UcjbWeight,
            SizeId = job.UcjbSize,
            IncludeFuelSurcharge = false,
            IsDirect = job.Direct,
            AcceptedJobTypeId = job.AcceptedJobTypeId,
            OurRef = job.UcjbOurRef,
            RefA = job.UcjbClientRefa,
            RefB = job.UcjbClientRefb,
            Quantity = job.UcjbQty ?? 1,
            BookedDate = job.UcjbDate.HasValue
                ? new DateTime(
                    job.UcjbDate.Value.Year,
                    job.UcjbDate.Value.Month,
                    job.UcjbDate.Value.Day,
                    job.UcjbTime.HasValue ? job.UcjbTime.Value.Hour : 0,
                    job.UcjbTime.HasValue ? job.UcjbTime.Value.Minute : 0,
                    job.UcjbTime.HasValue ? job.UcjbTime.Value.Second : 0)
                : DateTime.MinValue,

            PickupLat = job.PickUpLatitude ?? 0,
            PickupLong = job.PickUpLongitude ?? 0,
            DeliveryLat = job.DeliveryLatitude ?? 0,
            DeliveryLong = job.DeliveryLongitude ?? 0,

            DangerousGoods = job.Dgdocument ?? false,
            TotalPallets = 0,
            ExtraStopOffs = 0,
            DryIceWeight = job.DryIceWeight ?? 0,
            PickupWaitTime = job.WaitedPickUp ?? 0,
            DeliveryWaitTime = job.WaitedDelivery ?? 0,

            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
            ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

            ClientDiscount = job.UcjbClient != null ? job.UcjbClient.Discount : 0,
            Cubic = job.TucJobItemsArchives.Sum(i => i.Cubic),
            IsManuallyRated = job.RatedManually,
            CalculateDimsOncePerJob = job.DimensionsType == 2,
            IsPrebook = job.IsRecurringJob,
            BulkScheduleId = job.ScheduleId,
            CreatedTime = job.CreatedTime,

            FromCompanyName = job.PickupAddressLine1,
            FromBuildingName = job.PickupAddressLine2,
            FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
            FromSuburb = job.PickupAddressLine5,
            FromCity = job.PickupAddressLine6,
            FromState = null,
            FromPostCode = job.PickupAddressLine7,
            FromCountryCode = job.PickupAddressLine8,

            ToCompanyName = job.DeliveryAddressLine1,
            ToBuildingName = job.DeliveryAddressLine2,
            ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
            ToSuburb = job.DeliveryAddressLine5,
            ToCity = job.DeliveryAddressLine6,
            ToState = null,
            ToPostCode = job.DeliveryAddressLine7,
            ToCountryCode = job.DeliveryAddressLine8,

            Packages = job.TucJobItemsArchives.Select(item => new PackageDetailsDto
            {
                Name = item.Notes,
                Length = item.Length,
                Width = item.Depth,
                Height = item.Height,
                Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                Kg = item.Weight,
                Type = null,
                PackageCode = null,
                Units = item.Items
            }).ToList(),

            PickupTailLift = job.TucJobItemsArchives.Any(i => i.Pu == true),
            DropoffTailLift = job.TucJobItemsArchives.Any(i => i.Do == true),
            PrivateRes = job.TucJobItemsArchives.Any(i => i.PrivateRes == true),
            HasDgDocuments = job.Dgdocument,
            TruckStartTime = job.TruckStartTime.HasValue ? job.TruckStartTime.ToString() : null,
            TruckHours = job.TruckHours.HasValue ? (int)job.TruckHours : null,
            JobType = JobType.Archived,
            IsTruck = job.Truck ?? false
        };

    /// <summary>
    /// Maps a TucJobBooking to JobRatingDetailsDto (US tenant rating, prebook/recurring jobs).
    /// </summary>
    public static Expression<Func<TucJobBooking, JobRatingDetailsDto>> JobBookingRatingUsMapping() =>
        job => new JobRatingDetailsDto
        {
            JobId = job.UcbkId,
            ClientId = job.UcbkClientId ?? 0,
            FromId = (int)job.UcbkFrom,
            ToId = (int)job.UcbkTo,
            SpeedId = job.UcbkSpeed ?? 0,
            IsPedal = job.UcbkCbd ?? false,
            IsVan = job.UcbkVan,
            IsReturnJob = job.UcbkReturn,
            Weight = job.UcbkWeight ?? 0,
            SizeId = job.UcbkSize ?? 0,
            IncludeFuelSurcharge = false,
            IsDirect = job.Direct,
            AcceptedJobTypeId = job.AcceptedJobTypeId ?? 0,
            OurRef = job.UcbkOurRef,
            RefA = job.UcbkClientRefa,
            RefB = job.UcbkClientRefb,
            Quantity = job.Quantity.HasValue ? (int)job.Quantity : 0,
            BookedDate = job.UcbkDate ?? DateTime.MinValue,
            PreviousRate = job.UcbkAmount,

            PickupLat = job.PickUpLatitude ?? 0,
            PickupLong = job.PickUpLongitude ?? 0,
            DeliveryLat = job.DeliveryLatitude ?? 0,
            DeliveryLong = job.DeliveryLongitude ?? 0,

            FromZip = job.PickupAddressLine7,
            ToZip = job.DeliveryAddressLine7,
            DangerousGoods = job.Dgdocument ?? false,
            TotalPallets = job.TucJobBookingItemBookings.Count,
            ExtraStopOffs = 0,
            DryIceWeight = job.DryIceWeight ?? 0,
            PickupWaitTime = 0,
            DeliveryWaitTime = 0,

            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
            ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

            ClientDiscount = job.UcbkClient != null ? job.UcbkClient.Discount : 0,
            Cubic = job.TucJobBookingItemBookings.Sum(i => i.Cubic),
            CalculateDimsOncePerJob = job.DimensionsType == 2,
            IsPrebook = true
        };

    /// <summary>
    /// Maps a TucJobBooking to JobRatingDetailsDtoNz (NZ tenant rating, prebook/recurring jobs).
    /// </summary>
    public static Expression<Func<TucJobBooking, JobRatingDetailsDtoNz>> JobBookingRatingNzMapping() =>
        job => new JobRatingDetailsDtoNz
        {
            JobId = job.UcbkId,
            ClientId = job.UcbkClientId ?? 0,
            FromId = (int)job.UcbkFrom,
            ToId = (int)job.UcbkTo,
            SpeedId = job.UcbkSpeed ?? 0,
            IsPedal = job.UcbkCbd ?? false,
            IsVan = job.UcbkVan,
            IsReturnJob = job.UcbkReturn,
            Weight = job.UcbkWeight ?? 0,
            SizeId = job.UcbkSize ?? 0,
            IncludeFuelSurcharge = false,
            IsDirect = job.Direct,
            AcceptedJobTypeId = job.AcceptedJobTypeId ?? 0,
            OurRef = job.UcbkOurRef,
            RefA = job.UcbkClientRefa,
            RefB = job.UcbkClientRefb,
            Quantity = job.Quantity.HasValue ? (int)job.Quantity : 0,
            BookedDate = job.UcbkDate.HasValue
                ? new DateTime(
                    job.UcbkDate.Value.Year,
                    job.UcbkDate.Value.Month,
                    job.UcbkDate.Value.Day,
                    job.UcbkTime.HasValue ? job.UcbkTime.Value.Hour : 0,
                    job.UcbkTime.HasValue ? job.UcbkTime.Value.Minute : 0,
                    job.UcbkTime.HasValue ? job.UcbkTime.Value.Second : 0
                )
                : DateTime.MinValue,

            PreviousRate = job.UcbkAmount,

            PickupLat = job.PickUpLatitude ?? 0,
            PickupLong = job.PickUpLongitude ?? 0,
            DeliveryLat = job.DeliveryLatitude ?? 0,
            DeliveryLong = job.DeliveryLongitude ?? 0,

            FromZip = job.PickupAddressLine7,
            ToZip = job.DeliveryAddressLine7,
            DangerousGoods = job.Dgdocument ?? false,
            TotalPallets = job.TucJobBookingItemBookings.Count,
            ExtraStopOffs = 0,
            DryIceWeight = job.DryIceWeight ?? 0,
            PickupWaitTime = 0,
            DeliveryWaitTime = 0,

            FromAirportId = job.FromAirportId,
            ToAirportId = job.ToAirportId,
            FromAgentId = job.FromAirport != null ? job.FromAirport.AgentId : null,
            ToAgentId = job.ToAirport != null ? job.ToAirport.AgentId : null,

            ClientDiscount = job.UcbkClient != null ? job.UcbkClient.Discount : 0,
            Cubic = job.TucJobBookingItemBookings.Sum(i => i.Cubic),
            IsManuallyRated = job.RatedManually,
            IsPrebook = true,
            CalculateDimsOncePerJob = job.DimensionsType == 2,

            FromCompanyName = job.PickupAddressLine1,
            FromBuildingName = job.PickupAddressLine2,
            FromStreetAddress = job.PickupAddressLine3 + " " + job.PickupAddressLine4,
            FromSuburb = job.PickupAddressLine5,
            FromCity = job.PickupAddressLine6,
            FromState = null,
            FromPostCode = job.PickupAddressLine7,
            FromCountryCode = job.PickupAddressLine8,

            ToCompanyName = job.DeliveryAddressLine1,
            ToBuildingName = job.DeliveryAddressLine2,
            ToStreetAddress = job.DeliveryAddressLine3 + " " + job.DeliveryAddressLine4,
            ToSuburb = job.DeliveryAddressLine5,
            ToCity = job.DeliveryAddressLine6,
            ToState = null,
            ToPostCode = job.DeliveryAddressLine7,
            ToCountryCode = job.DeliveryAddressLine8,

            Packages = job.TucJobBookingItemBookings.Select(item => new PackageDetailsDto
            {
                Name = item.Notes,
                Length = item.Length,
                Width = item.Depth,
                Height = item.Height,
                Cubic = item.Cubic.HasValue ? (double)item.Cubic : 0,
                Kg = item.Weight,
                Type = null,
                PackageCode = null,
                Units = item.Items
            }).ToList(),

            PickupTailLift = null,
            DropoffTailLift = null,
            PrivateRes = job.DeliverToPrivateBusiness == 1,
            HasDgDocuments = job.Dgdocument,
            TruckStartTime = job.TruckStartTime != null ? job.TruckStartTime.ToString() : null,
            TruckHours = job.TruckHours != null ? (int)job.TruckHours : null,
            JobType = JobType.Recurring,
            IsTruck = job.Truck ?? false,
            BulkScheduleId = job.ScheduleId
        };
}
