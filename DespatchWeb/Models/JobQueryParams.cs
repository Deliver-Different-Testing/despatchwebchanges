namespace DespatchWeb.Models;

public class JobQueryParams
{
    public string Status { get; set; } = "all";
    public string Order { get; set; } = "time";
    public string Asc { get; set; } = "asc";
}