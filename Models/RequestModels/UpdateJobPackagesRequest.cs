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

    /// <summary>
    /// When set, updates the job's DimensionsType: true writes 2 (Per Job — dimensions
    /// entered once for the whole job, quantity not multiplied into pricing), false clears
    /// it to null (Per Item — the default). Null leaves the existing value untouched.
    /// </summary>
    public bool? CalculateDimsOncePerJob { get; init; }
}