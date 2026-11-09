namespace DespatchWeb.EntityClasses;

public partial class TblBulkRunSchedule
{
    // tblBulkRunSchedule is a keyless view, so it can only be the dependent side of a relationship.
    public virtual TblBulkRegion RegionNavigation { get; set; }
}
