using System;

namespace DespatchWeb.Models;

public class ClearListResult
{
    public int? CourierId { get; set; }
    public string Code { get; set; }
    public int DisplayOrder { get; set; }
    public string Deliver { get; set; }
    public DateTime? DisplayOrderDesc { get; set; }
    public DateTime? DisplayOrderAsc { get; set; }
    public bool? AutoDespatch { get; set; }
}
