namespace DespatchWeb.Models.Response;

public sealed record HereMapRouteResponseV8
{
    public IReadOnlyList<Route> Routes { get; init; }
    public IReadOnlyList<Notice> Notices { get; init; }
}

public sealed record Notice
{
    public string Title { get; init; }
    public string Code { get; init; }

    public string Severity { get; init; }
}

public readonly record struct Location
{
    public double Lat { get; init; }
    public double Lng { get; init; }
}

public sealed record Place
{
    public Location Location { get; init; }
    public string Type { get; init; }
}

public sealed record Arrival
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}

public sealed record Departure
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}

public readonly record struct Summary
{
    public float Duration { get; init; }
    public float Length { get; init; }
}

public sealed record Transport
{
    public string Mode { get; init; }
}

public sealed record Section
{
    public Arrival Arrival { get; init; }
    public Departure Departure { get; init; }
    public string Id { get; init; }
    public Summary Summary { get; init; }
    public Transport Transport { get; init; }
    public string Type { get; init; }
}

public sealed record Route
{
    public string Id { get; init; }
    public IReadOnlyList<Section> Sections { get; init; }
}