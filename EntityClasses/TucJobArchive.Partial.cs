using System.Collections.Generic;

namespace DespatchWeb.EntityClasses;

public partial class TucJobArchive
{
    // Navigation properties to eliminate joins
    public virtual TucClient UcjbClient { get; set; }
    public virtual TucClientContact Contact { get; set; }
    public virtual TucJobInternalStatus InternalStatusNavigation { get; set; }
    public virtual TblUndeliverableLocation UndeliverableLocation { get; set; }
    public virtual TucJobType NotifiedJobType { get; set; }
    public virtual TucJobType SpeedNavigation { get; set; }
    public virtual TblJobLeaveNotHome DeliverToLeave { get; set; }

    public virtual TucJobArchive Parent { get; set; }
    public virtual ICollection<TucJobArchive> InverseParent { get; set; } = new List<TucJobArchive>();

    public virtual TucJobNationwide Nationwide { get; set; }
    public virtual ICollection<PricingBreakdownArchive> PricingBreakdowns { get; set; } = new List<PricingBreakdownArchive>();
    public virtual ICollection<TucNoteArchive> NoteArchives { get; set; } = new List<TucNoteArchive>();

    public virtual TucClientContact LoggedInContact { get; set; }

    public virtual TucInvoiceProcess InvoiceProcess { get; set; }

    // Additional navigation properties matching TucJob
    public virtual TucJobType AcceptedJobType { get; set; }
    public virtual TucJobType DesiredJobType { get; set; }
    public virtual TucCourier UcjbCourier { get; set; }
    public virtual TucJobStatus UcjbStatusNavigation { get; set; }
    public virtual TucSuburb UcjbFromNavigation { get; set; }
    public virtual TucSuburb UcjbToNavigation { get; set; }
    public virtual TucSource Source { get; set; }
    public virtual TucCourier ClosestCourier { get; set; }
    public virtual TblJobRelationshipType JobRelationshipType { get; set; }
}