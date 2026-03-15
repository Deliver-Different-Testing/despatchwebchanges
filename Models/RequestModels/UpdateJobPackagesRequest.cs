namespace DespatchWeb.Models.RequestModels;

public class UpdateJobPackagesRequest : UpdateJobPackagesBase
{
    public int JobId { get; init; }
}

public class UpdateBulkJobPackagesRequest : UpdateJobPackagesBase
{
    public int BulkJobId { get; init; }
}

public class UpdateJobPackagesBase
{
    public List<ParcelDimensions> Parcels { get; init; }
}