using System;
using System.Collections.Generic;

namespace DespatchWeb.Models.Response;

public class HereMapRouteResponseV8
{
    public List<Route> Routes { get; set; }
    public List<Notice> Notices { get; set; }
}

public class Notice
{
    public string Title { get; set; }
    public string Code { get; set; }

    public string Severity { get; set; }
}

public class Location
{
    public double Lat { get; set; }
    public double Lng { get; set; }
}

public class Place
{
    public Location Location { get; set; }
    public string Type { get; set; }
}

public class Arrival
{
    public Place Place { get; set; }
    public DateTime Time { get; set; }
}

public class Departure
{
    public Place Place { get; set; }
    public DateTime Time { get; set; }
}

public class Summary
{
    public float Duration { get; set; }
    public float Length { get; set; }
}

public class Transport
{
    public string Mode { get; set; }
}

public class Section
{
    public Arrival Arrival { get; set; }
    public Departure Departure { get; set; }
    public string Id { get; set; }
    public Summary Summary { get; set; }
    public Transport Transport { get; set; }
    public string Type { get; set; }
}

public class Route
{
    public string Id { get; set; }
    public List<Section> Sections { get; set; }
}