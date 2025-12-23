namespace DespatchWeb.EntityClasses;

public partial class TblJob
{
    // Navigation properties where TblJob is the dependent (has FK to keyed entity)
    // TblJob is a keyless view, so it cannot be principal in any relationship
    public virtual TucClient Client { get; set; }
    public virtual TucJobStatus StatusNavigation { get; set; }
    public virtual TucAgent Agent { get; set; }
    public virtual TucInvoiceNo Invoice { get; set; }
    public virtual TucClientContact LoggedInContact { get; set; }
    public virtual TucCourier Courier { get; set; }
    public virtual TucSuburb FromSuburb { get; set; }
    public virtual TucSuburb ToSuburb { get; set; }

    // Note: Nationwide, PricingBreakdowns, Parent/Children navigation properties
    // cannot be configured because TblJob is keyless and cannot be a principal.
    // Use Context subqueries in LINQ for these relationships.
}
