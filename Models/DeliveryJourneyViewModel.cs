using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class DeliveryJourneyViewModel
{
    public Guid Id { get; init; }
    public int JobId { get; init; }
    public string Title { get; init; }
    public string Icon { get; init; }
    public string Description { get; init; }
    public DateTimeOffset Date { get; init; }
    public List<string> Tags { get; init; }
}