using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class JobViewModel
{
    public int Id { get; set; }
    public int? RootParentId { get; set; }
    public DateTime? Time { get; set; }
    public DateTime? BookedDate { get; set; }
    public bool? Direct { get; set; }
    public bool Van { get; set; }
    public int? JobRelationshipTypeId { get; set; }
    public bool? VanOk { get; set; }
    public bool? Done { get; set; }
    public bool? Void { get; set; }
    public bool? Truck { get; set; }
    public bool? SaturdayDelivery { get; set; }
    public bool? Return { get; set; }
    public bool? Pedal { get; set; }
    public bool? Reprice { get; set; }
    public bool? Attention { get; set; }
    public short? PickupFrom { get; set; }
    public string JobNo { get; set; }
    public string Speed { get; set; }
    public string SpeedName { get; set; }

    public string Source { get; set; }
    public string NotifiedName { get; set; }
    public string AcceptedName { get; set; }
    [JsonPropertyName("speedID")] public int? SpeedId { get; set; }

    public string Notify { get; set; }
    public Vehicle Vehicle { get; set; }

    [JsonPropertyName("clientID")] public int? ClientId { get; set; }

    public int? JobType { get; set; }
    public string Client { get; set; }
    public string ClientName { get; set; }

    [Obsolete("Use PickupAddress instead. This property will be removed in a future version.")]
    public string From { get; set; }

    [Obsolete("Use PickupAddress instead. This property will be removed in a future version.")]
    [JsonPropertyName("fromSuburbID")]
    public int? FromSuburbId { get; set; }

    [Obsolete("Use PickupAddress instead. This property will be removed in a future version.")]
    [JsonPropertyName("fromSuburbName")]
    public string FromSuburbName { get; set; }

    [Obsolete("Use PickupAddress instead. This property will be removed in a future version.")]
    public string FromPostCode { get; set; }

    [Obsolete("Use PickupAddress instead. This property will be removed in a future version.")]
    [JsonPropertyName("fromAddress")]
    public string FromAddress { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string To { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public int? ToSuburbId { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToSuburbName { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToPostCode { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToAddress { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToCity { get; set; }

    public string Courier { get; set; }
    public decimal? GstRate { get; set; }
    public int? Remain { get; set; }
    public int? PickupTime { get; set; }
    public int? DeliveryTime { get; set; }
    public int? AlertLatePickup { get; set; }
    public int? AlertLateDelivery { get; set; }
    public int? Minutes { get; set; }
    public int? StatusId { get; set; }
    public string Status { get; set; }
    public string StatusName { get; set; }
    public int? Lp { get; set; }
    public int? Ld { get; set; }
    public string ContactName { get; set; }
    public string LoggedInContactName { get; set; }

    [JsonPropertyName("deliverToContact")] public string DeliverToContact { get; set; }

    public int? TrackingMethod { get; set; }
    public string TrackingMobile { get; set; }
    public string TrackingEmail { get; set; }
    public string UdStatus { get; set; }
    public byte[] PodPhoto { get; set; }
    public byte[] DeliverySignature { get; set; }
    public List<byte[]> PodPhotos { get; set; }
    public string PodName { get; set; }
    public string Phone { get; set; }
    public string SpeedAccepted { get; set; }
    public int? AcceptedJobTypeId { get; set; }
    public int? NotifiedJobTypeId { get; set; }
    public Vehicle Size { get; set; }
    public double? Weight { get; set; }
    public short? Items { get; set; }
    public string RefA { get; set; }
    public string RefB { get; set; }
    public string OurRef { get; set; }
    public string SigNotRequired { get; set; }
    public string Charge { get; set; }
    public string Date { get; set; }
    public DateTime? DispatchTime { get; set; }
    public DateTime Booked { get; set; }
    public DateTime? PuTime { get; set; }
    public string ClientNotes { get; set; }
    public string InternalNotes { get; set; }
    public DateTime? FollowupTime { get; set; }
    public int? InternalStatusId { get; set; }
    public string ChildNotes { get; set; }
    public bool? Locked { get; set; }
    public bool? Invoiced { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public decimal? PickUpLongitude { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public decimal? PickUpLatitude { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public decimal? DeliveryLongitude { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public decimal? DeliveryLatitude { get; set; }

    public List<PalletInfo> PalletInfo { get; set; }
    public List<Size> RelatedJobs { get; set; }
    public decimal? CourierLatitude { get; set; }
    public decimal? CourierLongitude { get; set; }
    public int? RunOrder { get; set; }
    public CourierData CourierData { get; set; }
    public bool? AllowDispatch { get; set; }
    public bool? DgDocumentation { get; set; }
    public int? DgClass { get; set; }
    public bool? DisplaySplitJobDetail { get; set; }
    public int? TruckWeightLimit { get; set; }
    public DateTime? TruckStartTime { get; set; }
    public double? TruckHours { get; set; }
    public bool? PrivateRes { get; set; }
    public bool? AllowSplit { get; set; }
    public DateTime? CompletedTime { get; set; }
    public string FromContactName { get; set; }
    public string FromContactNumber { get; set; }
    public bool? RatedManually { get; set; }
    public short? SizeId { get; set; }
    public bool? Active { get; set; }
    public bool? OneOff { get; set; }
    public string InActiveBy { get; set; }
    public DateTime? InActiveDate { get; set; }
    public DateTime? FirstDue { get; set; }
    public DateTime? NextDue { get; set; }
    public DateTime? LastDone { get; set; }
    public DateTime? StopDate { get; set; }
    public DateTime? RestartDate { get; set; }
    public string Days { get; set; }
    public bool? PreBook { get; set; }
    public bool? BulkJob { get; set; }
    public string RunName { get; set; }

    public string ScheduleName { get; set; }
    public string ConNote { get; set; }
    public bool? AirportOnly { get; set; }
    public bool? HasNationwide { get; set; }
    public string DispatcherName { get; set; }
    public DateTime? CreatedDate { get; set; }

    public AddressViewModel PickupAddress { get; set; }
    public AddressViewModel DeliveryAddress { get; set; }

    public int? ToAirportId { get; set; }
    public int? FromAirportId { get; set; }

    public AssignedFlight AssignedFlight { get; set; }

    public AgentViewModel AssignedAgent { get; set; }

    public Suggestion AssignedCourier { get; set; }
}

public class AssignedFlight
{
    public string FlightNumber { get; set; }
    public DateTime? ExpectedDeparture { get; set; }
    public DateTime? ExpectedArrival { get; set; }
    public string Notes { get; set; }
}

public class Vehicle
{
    public short? Id { get; set; }
    public string Label { get; set; }
}

public class Size
{
    public int Id { get; set; }
    public string Label { get; set; }
}

public class PalletInfo
{
    public int Id { get; set; }
    public int Quantity { get; set; }
    public double Weight { get; set; }
    public double Length { get; set; }
    public double Depth { get; set; }
    public double Height { get; set; }
    public bool? Pu { get; set; }
    public bool? Do { get; set; }
    public int? DgClass { get; set; }
    public string Notes { get; set; }
    public int ItemId { get; set; }
}

public class AddressViewModel
{
    public string AddressLine1 { get; set; }
    public string AddressLine2 { get; set; }
    public string AddressLine3 { get; set; }
    public string AddressLine4 { get; set; }
    public string AddressLine5 { get; set; }
    public string AddressLine6 { get; set; }
    public string AddressLine7 { get; set; }
    public string AddressLine8 { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }

    public string FullAddress =>
        string.Join(", ", new[]
            {
                AddressLine1,
                AddressLine2,
                AddressLine3,
                AddressLine4,
                AddressLine5,
                AddressLine6,
                AddressLine7,
                AddressLine8
            }
            .Where(line => !string.IsNullOrWhiteSpace(line)));
}

public class Suggestion
{
    public int Id { get; set; }
    public string Text { get; set; }
}
