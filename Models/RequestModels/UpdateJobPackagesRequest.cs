namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateJobPackagesRequest : UpdateJobPackagesBase
{
    public int JobId { get; init; }
}

public sealed class UpdateBulkJobPackagesRequest : UpdateJobPackagesBase
{
    public int BulkJobId { get; init; }
}

public class UpdateJobPackagesBase
{
    public List<ParcelDimensions> Parcels { get; init; }
    public decimal? Weight { get; init; }
}