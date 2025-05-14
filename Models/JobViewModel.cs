using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json.Serialization;

namespace DespatchWeb.Models;

public class JobViewModel : DispatchJobViewModel
{
    public DateTime? BookedDate { get; set; }
    public bool Van { get; set; }
    public int? JobRelationshipTypeId { get; set; }
    public bool? VanOk { get; set; }
    public bool? Void { get; set; }
    public bool? Truck { get; set; }
    public bool? Pedal { get; set; }
    public bool? Reprice { get; set; }
    public bool? Attention { get; set; }
    public string SpeedName { get; set; }
    public string RunName { get; set; }

    public string Source { get; set; }
    public string NotifiedName { get; set; }
    public string AcceptedName { get; set; }

    public string ClientName { get; set; }

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
    public string ToSuburbName { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToPostCode { get; set; }

    [Obsolete("Use DeliveryAddress instead. This property will be removed in a future version.")]
    public string ToCity { get; set; }

    public decimal? GstRate { get; set; }
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
    public string ToContactPhone { get; set; }
    public string SpeedAccepted { get; set; }
    public int? AcceptedJobTypeId { get; set; }
    public int? NotifiedJobTypeId { get; set; }
    public double? Weight { get; set; }
    public short? Items { get; set; }
    public string RefA { get; set; }
    public string RefB { get; set; }
    public string OurRef { get; set; }
    public string SigNotRequired { get; set; }
    public string Charge { get; set; }
    public string Date { get; set; }
    public DateTime? DispatchTime { get; set; }
    public DateTime? PuTime { get; set; }

    public DateTime? FollowupTime { get; set; }
    public int? InternalStatusId { get; set; }
    public string ConNote {get;set;}
    public List<PalletInfo> PalletInfo { get; set; }
    public decimal? CourierLatitude { get; set; }
    public decimal? CourierLongitude { get; set; }
    public int? RunOrder { get; set; }
    public bool? AllowDispatch { get; set; }
    public bool? DgDocumentation { get; set; }
    public int? TruckWeightLimit { get; set; }
    public DateTime? TruckStartTime { get; set; }
    public double? TruckHours { get; set; }
    public bool? PrivateRes { get; set; }
    public DateTime? CompletedTime { get; set; }
    public string FromContactName { get; set; }
    public string FromContactNumber { get; set; }
    public bool? RatedManually { get; set; }
    public int? SizeId { get; set; }
    public bool? OneOff { get; set; }

    public string ScheduleName { get; set; }
    public bool? AirportOnly { get; set; }
    public bool? HasNationwide { get; set; }
    public string DispatcherName { get; set; }
    public DateTime? CreatedDate { get; set; }

    public List<ParcelDimensions> ParcelDimensions { get; set; }

    public int? DeliverToLeaveId { get; set; }

    public bool IsArchived { get; set; }
    public DateTime? DeliverByTime { get; set; }

    public List<TucNoteViewModel> Notes { get; set; }

    public double Distance { get; set; }

    public ReadTrackerInfoViewModel ReadTrackerInfo { get; set; }

    public int? PickUpWindowMins { get; set; }

    public int? DeliverByWindowMins { get; set; }

    public Suggestion  PickUpTimeZone { get; set; }
    public Suggestion DeliveryTimeZone {get;set;}
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

public class ParcelDimensions
{
    private string _dimensions;
    public int? ItemId { get; set; }
    public string ItemName { get; set; }
    public double? Height { get; set; }
    public double? Length { get; set; }
    public double? Depth { get; set; }

    public string Dimensions
    {
        get
        {
            if (Height.HasValue && Length.HasValue && Depth.HasValue)
            {
                return $"{Length.Value:0.#}x{Depth.Value:0.#}x{Height.Value:0.#}";
            }

            return _dimensions;
        }
        set => _dimensions = value;
    }
}

public class AssignedFlight
{
    public string FlightNumber { get; set; }
    public DateTime? ExpectedDeparture { get; set; }
    public string DepartureTimeZone {get;set;}
    public DateTime? ExpectedArrival { get; set; }
    public string ArrivalTimeZone { get; set; }
    public string Notes { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = new();
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
    public AddressViewModel(string addressLine1, string addressLine2, string addressLine3, string addressLine4, string addressLine5, string addressLine6, string addressLine7, string addressLine8)
    {
        AddressLine1 = addressLine1;
        AddressLine2 = addressLine2;
        AddressLine3 = addressLine3;
        AddressLine4 = addressLine4;
        AddressLine5 = addressLine5;
        AddressLine6 = addressLine6;
        AddressLine7 = addressLine7;
        AddressLine8 = addressLine8;
    }

    public AddressViewModel()
    {
    }

    public string AddressLine1 { get; init; }
    public string AddressLine2 { get; init; }
    public string AddressLine3 { get; init; }
    public string AddressLine4 { get; init; }
    public string AddressLine5 { get; init; }
    public string AddressLine6 { get; init; }
    public string AddressLine7 { get; init; }
    public string AddressLine8 { get; init; }
    public decimal? Latitude { get; init; }
    public decimal? Longitude { get; init; }

    public string FullAddress =>
        string.Join(
            ", ",
            new[]
            {
                AddressLine1,
                AddressLine2,
                AddressLine3,
                AddressLine4,
                AddressLine5,
                AddressLine6,
                AddressLine7,
                AddressLine8
            }.Where(line => !string.IsNullOrWhiteSpace(line))
        );
}

public class EditAddressDialogViewModel : AddressViewModel
{
    public ShipmentDetails ShipmentDetails { get; set; }
}

public class ShipmentDetails
{
    public string ContactName { get; set; }
    public string ContactPhone { get; set; }
    public double Weight { get; set; }
    public int Quantity { get; set; }
    public string JobNotes { get; set; }
}

public class Suggestion
{
    public int Id { get; set; }
    public string Text { get; set; }
}

public class TimeZoneSuggestion : Suggestion
{
    public string TimeZoneIana {get;set;}
}

public class NoteTypeViewModel : Suggestion
{
    public bool IsPublic { get; set; }
    public string Description { get; set; }
}

public class ReadTrackerInfoViewModel
{
    public bool HasBeenRead { get; set; }
    public string ReadBy { get; set; }
    public DateTime? ReadDate { get; set; }
}
