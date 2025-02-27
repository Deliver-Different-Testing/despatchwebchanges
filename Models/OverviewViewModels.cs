using System.Collections.Generic;

namespace DespatchWeb.Models;

public class DeliveryJob
{
    public int JobId { get; set; }
    public string JobName { get; set; }
    public string Status { get; set; }
    public int Completion { get; set; }
    public string Pickup { get; set; }
    public string Delivery { get; set; }
    public string Driver { get; set; }
    public string Region { get; set; }
    public List<ChildDeliveryJob> ChildJobs { get; set; } = [];
}

public class ChildDeliveryJob
{
    public int JobId { get; set; }
    public string JobName { get; set; }
    public string Status { get; set; }
    public int Completion { get; set; }
    public string Pickup { get; set; }
    public string Delivery { get; set; }
    public string Driver { get; set; }
    public string Region { get; set; }
}
