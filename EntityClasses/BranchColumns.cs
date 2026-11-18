#nullable disable
namespace DespatchWeb.EntityClasses;

// Branches programme (B2). tblBranch and the BranchId columns come from dbmigrationsv2 (AddBranches, AddBranchSiteId,
// BranchFleetColumnAndBackfill). Hand-written partials so a re-scaffold of the context cannot drop them.
public partial class TblBranch
{
    public int BranchId { get; set; }
    public string Name { get; set; }
    public string Code { get; set; }
    public int? SiteId { get; set; }
    public bool IsDefault { get; set; }
    public bool Active { get; set; }
}

// NULL = the default branch (D1).
public partial class TucClient { public int? BranchId { get; set; } }
public partial class TucCourier { public int? BranchId { get; set; } }
