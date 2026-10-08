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
