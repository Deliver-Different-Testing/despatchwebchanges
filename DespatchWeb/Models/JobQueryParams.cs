namespace DespatchWeb.Models;

public class JobQueryParams
{
    public string Status { get; set; } = "all";
    public string Area { get; set; } = "";
    public string Order { get; set; } = "time";
    public string Asc { get; set; } = "asc";
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 50;
}