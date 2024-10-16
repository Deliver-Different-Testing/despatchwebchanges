using System;

namespace DespatchWeb.Models;

public class AssignFlightToJobRequest
{
    public int JobId { get; set; }
    public string FlightNumber { get; set; }
    public DateTime DepartureDate { get; set; }
}