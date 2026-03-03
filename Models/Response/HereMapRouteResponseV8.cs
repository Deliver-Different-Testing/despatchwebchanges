using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class HereMapRouteResponseV8
{
    public List<Route> Routes { get; init; }
    public List<Notice> Notices { get; init; }
}

public class Notice
{
    public string Title { get; init; }
    public string Code { get; init; }

    public string Severity { get; init; }
}

public class Location
{
    public double Lat { get; init; }
    public double Lng { get; init; }
}

public class Place
{
    public Location Location { get; init; }
    public string Type { get; init; }
}

public class Arrival
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}

public class Departure
{
    public Place Place { get; init; }
    public DateTime Time { get; init; }
}

public class Summary
{
    public float Duration { get; init; }
    public float Length { get; init; }
}

public class Transport
{
    public string Mode { get; init; }
}

public class Section
{
    public Arrival Arrival { get; init; }
    public Departure Departure { get; init; }
    public string Id { get; init; }
    public Summary Summary { get; init; }
    public Transport Transport { get; init; }
    public string Type { get; init; }
}

public class Route
{
    public string Id { get; init; }
    public List<Section> Sections { get; init; }
}