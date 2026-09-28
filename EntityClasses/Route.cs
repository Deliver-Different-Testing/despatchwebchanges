#nullable disable
using System;

namespace DespatchWeb.EntityClasses;

/// <summary>
/// Recurring Route — a named cluster of zipcodes visited by a rostered driver.
/// Created by the app-configurator (database/032-create-routes-and-roster.sql).
/// tucJobBooking rows opt in to a route via tucJobBooking.RouteId.
/// </summary>
public partial class Route
{
    public int RouteId { get; set; }

    public string Name { get; set; }

    public string Area { get; set; }

    public int? DefaultCourierId { get; set; }

    public bool Active { get; set; }

    public DateTime CreatedAt { get; set; }

    public string CreatedBy { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public string UpdatedBy { get; set; }

    public virtual TucCourier DefaultCourier { get; set; }
}
