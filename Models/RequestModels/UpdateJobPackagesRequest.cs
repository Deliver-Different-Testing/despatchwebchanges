namespace DespatchWeb.Models.RequestModels;

public sealed class UpdateJobPackagesRequest : UpdateJobPackagesBase
{
    public int JobId { get; init; }
}
