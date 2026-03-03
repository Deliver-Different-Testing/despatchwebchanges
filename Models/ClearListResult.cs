using System;

namespace DespatchWeb.Models;

public class ClearListResult
{
    public int? CourierId { get; init; }
    public string Code { get; init; }
    public int DisplayOrder { get; init; }
    public string Deliver { get; init; }
    public DateTime? DisplayOrderDesc { get; init; }
    public DateTime? DisplayOrderAsc { get; init; }
    public bool? AutoDespatch { get; init; }
}
