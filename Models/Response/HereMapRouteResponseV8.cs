namespace DespatchWeb.Models.Response;

public sealed record HereMapRouteResponseV8
{
    public IReadOnlyList<Route> Routes { get; init; }
    public IReadOnlyList<Notice> Notices { get; init; }
}
