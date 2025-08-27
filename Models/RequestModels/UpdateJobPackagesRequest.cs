using System.Collections.Generic;

namespace DespatchWeb.Models.RequestModels;

public class UpdateJobPackagesRequest
{
    public int JobId { get; init; }
    public List<ParcelDimensions> Parcels { get; init; }
}