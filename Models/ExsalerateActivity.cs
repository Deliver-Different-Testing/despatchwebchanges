namespace DespatchWeb.Models;

public sealed class ExsalerateActivity
{
    public int SiteOwnerID { get; init; }
    public string CustomerRefCode { get; init; }
    public string Subject { get; init; }
    public string Description { get; init; }
    public string ActivityType { get; init; }
}