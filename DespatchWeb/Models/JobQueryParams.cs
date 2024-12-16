namespace DespatchWeb.Models;

public class JobQueryParams
{
    public int Status { get; set; }
    public string Order { get; set; }
    public string OrderDirection { get; set; }
    public int Page { get; set; } = 1;
    public int Limit { get; set; } = 10;
}