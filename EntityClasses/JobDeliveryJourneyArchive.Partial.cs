namespace DespatchWeb.EntityClasses;

public partial class JobDeliveryJourneyArchive
{
    // Navigation properties to match JobDeliveryJourney
    public virtual TucCourier Courier { get; set; }

    public virtual TucJobNationwide Flight { get; set; }

    public virtual TucJob Job { get; set; }

    public virtual TucAgent NewAgent { get; set; }

    public virtual TucCourier NewCourier { get; set; }

    public virtual TucJobInternalStatus NewInternalStatus { get; set; }

    public virtual TucJobStatus NewJobStatus { get; set; }

    public virtual TucAgent OldAgent { get; set; }

    public virtual TucCourier OldCourier { get; set; }

    public virtual TucJobInternalStatus OldInternalStatus { get; set; }

    public virtual TucJobStatus OldJobStatus { get; set; }

    public virtual TucStaff Staff { get; set; }
}
