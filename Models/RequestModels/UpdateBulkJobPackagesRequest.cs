namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateBulkJobPackagesRequest : UpdateJobPackagesBase
{
    public int BulkJobId { get; init; }
}
