using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class FlightOptionsViewModel
{
    public string Airline { get; set; }
    public string FlightNumber { get; set; }
    public DateTime DepartureTime { get; set; }
    public DateTime ArrivalTime { get; set; }
    public string DepartureAirport { get; set; }
    public string ArrivalAirport { get; set; }
    public TimeSpan Duration { get; set; }
    public int Stops { get; set; }
    public string Aircraft { get; set; }
    public List<string> ServiceClasses { get; set; }
    public bool IsCodeShare { get; set; }
    public string CodeShareAirline { get; set; }
}
