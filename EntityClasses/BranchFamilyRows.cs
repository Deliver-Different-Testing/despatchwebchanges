namespace DespatchWeb.EntityClasses;

// Read-only, filter-free views of the job tables for the branch rule (DespatchContext.BranchJobVisible).
// The rule has to look across a job's whole family, and a job filter cannot query its own filtered
// table, nor use IgnoreQueryFilters (that switches filters off for the rest of the outer query).

public sealed class BranchFamilyJob
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public int? RootParentId { get; set; }
    public int? ClientId { get; set; }
    public int? CourierId { get; set; }
    public int? FromSuburbId { get; set; }
    public int? ToSuburbId { get; set; }
}

public sealed class BranchFamilyJobArchive
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public int? RootParentId { get; set; }
    public int? ClientId { get; set; }
    public int? CourierId { get; set; }
    public int? FromSuburbId { get; set; }
    public int? ToSuburbId { get; set; }
}

public sealed class BranchFamilyJobBooking
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public int? RootParentId { get; set; }
    public int? ClientId { get; set; }
    public int? CourierId { get; set; }
}

public sealed class BranchFamilyBulkJob
{
    public int Id { get; set; }
    public int? ParentId { get; set; }
    public int? ClientId { get; set; }
    public int? CourierId { get; set; }
}
