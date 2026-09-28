namespace DespatchWeb.Models;

public class JobViewModel : DispatchJobViewModel
{
    public new bool Van { get; set; }
    public bool? VanOk { get; set; }
    public new bool? Truck { get; set; }
    public bool? Reprice { get; set; }
    public bool? Attention { get; set; }
    public string SpeedName { get; set; }
    public string RunName { get; set; }
    public string Barcode { get; set; }

    public bool IsInvoiced { get; set; }
    public string NotifiedName { get; set; }
    public string AcceptedName { get; set; }

    public string LoggedInContactName { get; set; }

    public string DeliverToContact { get; set; }

    public string DispatcherName { get; set; }

    public int? TrackingMethod { get; set; }
    public string TrackingMobile { get; set; }
    public string TrackingEmail { get; set; }
    public string UdStatus { get; set; }
    public byte[] PodPhoto { get; set; }
    public string PodName { get; set; }
    public string ToContactPhone { get; set; }
    public int? AcceptedJobTypeId { get; set; }
    public int? NotifiedJobTypeId { get; set; }
    public int Items { get; set; }
    public string RefB { get; set; }
    public string OurRef { get; set; }
    public string SigNotRequired { get; set; }
    public decimal? Charge { get; set; }
    public string Date { get; set; }
    public DateTime? DispatchTime { get; set; }
    public DateTime? PuTime { get; set; }

    public new DateTime? FollowupTime { get; set; }
    public List<PalletInfo> PalletInfo { get; set; }

    public bool? DgDocumentation { get; set; }

    public bool? PrivateRes { get; set; }
    public string FromContactName { get; set; }
    public string FromContactNumber { get; set; }
    public string FromContactNumberSource { get; set; }
    public string BookingContactEmail { get; set; }


    public string ScheduleName { get; set; }

    public DateTime? CreatedDate { get; set; }

    public List<ParcelDimensions> ParcelDimensions { get; set; }

    public int? DeliverToLeaveId { get; set; }

    public DateTime? DeliverByTime { get; set; }

    public List<TucNoteViewModel> Notes { get; set; }

    public double Distance { get; set; }

    public ReadTrackerInfoViewModel ReadTrackerInfo { get; set; }

    public int? PickUpWindowMins { get; set; }

    public int? DeliverByWindowMins { get; set; }

    public string HasDgDocsString { get; set; }
    public bool CalculateDimsOncePerJob { get; set; }

    // Tail Lift
    public bool TailLiftPu { get; set; }
    public bool TailLiftDo { get; set; }
    public bool DeliverToPrivateRes { get; set; }
    public Suggestion BookingSource { get; set; }

    // Arrival times
    public DateTime? PickupArrivalTime { get; set; }
    public DateTime? DeliveryArrivalTime { get; set; }

    // Flight detail card
    public bool IsFlightAssigned { get; set; }
}

public sealed class ParcelDimensions
{
    public int? ItemId { get; set; }
    public string ItemName { get; set; }
    public double? Height { get; set; }
    public double? Length { get; set; }
    public double? Depth { get; set; }
    public double? Weight { get; set; }
    public decimal? Cubic { get; set; }
    public string Barcode { get; set; }
}

public sealed class AssignedFlight
{
    public string FlightNumber { get; set; }
    public DateTimeOffset? ExpectedDeparture { get; set; }
    public string DepartureTimeZone { get; set; }
    public DateTimeOffset? ExpectedArrival { get; set; }
    public string ArrivalTimeZone { get; set; }
    public string Notes { get; set; }
    public List<FlightSegmentViewModel> FlightSegments { get; set; } = new();
}

public sealed class PalletInfo
{
    public int Id { get; set; }
    public int Quantity { get; set; }
    public double Weight { get; set; }
    public double Length { get; set; }
    public double Depth { get; set; }
    public double Height { get; set; }
    public double Cubic { get; set; }
    public bool? Pu { get; set; }
    public bool? Do { get; set; }
    public int? DgClass { get; set; }
    public string Notes { get; set; }
    public int ItemId { get; set; }
}

public class AddressViewModel
{
    public AddressViewModel(string addressLine1, string addressLine2, string addressLine3, string addressLine4,
        string addressLine5, string addressLine6, string addressLine7, string addressLine8)
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

public sealed class EditAddressDialogViewModel : AddressViewModel
{
    public ShipmentDetails ShipmentDetails { get; set; }
}

public sealed class ShipmentDetails
{
    public string ContactName { get; set; }
    public string ContactMobile { get; set; }
    public double Weight { get; set; }
    public double Depth { get; set; }
    public double Length { get; set; }
    public double Height { get; set; }
    public int? Quantity { get; set; }
    public string JobNotes { get; set; }
}

public class Suggestion
{
    public int Id { get; set; }
    public string Text { get; set; }
}

public sealed class MultiSuggestion : Suggestion
{
    public bool Selected { get; set; }
    public bool IsBulkJob { get; set; }
    public bool IsArchived { get; set; }
}

public sealed class AirlineSuggestion : Suggestion
{
    public string FullAirlineName { get; set; }
}

public sealed class AirportSuggestion : Suggestion
{
    public string Timezone { get; set; }
}

public sealed class TimeZoneSuggestion : Suggestion
{
    public string TimeZoneIana { get; set; }
}

public sealed class NoteTypeViewModel : Suggestion
{
    public bool IsPublic { get; set; }
    public bool IsCourierFacing { get; set; }
    public string Description { get; set; }
}

public sealed class ReadTrackerInfoViewModel
{
    public bool HasBeenRead { get; set; }
    public string ReadBy { get; set; }
    public DateTime? ReadDate { get; set; }
}