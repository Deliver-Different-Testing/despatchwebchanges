using System;
using System.Collections.Generic;

namespace DespatchWeb.Models;

public class DeliveryJourneyViewModel
{
    public Guid Id { get; set; }
    public int JobId { get; set; }
    public string Title { get; set; }
    public string Icon { get; set; }
    public string Description { get; set; }
    public DateTime Date { get; set; }
    public List<string> Tags { get; set; }
    public string Status { get; set; }
    public string Notes { get; set; }
}