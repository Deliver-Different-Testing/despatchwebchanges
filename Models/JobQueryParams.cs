using System;

namespace DespatchWeb.Models;

public class JobQueryParams
{
    public string Order { get; set; }
    public string OrderDirection { get; set; }
    public DateTime? DateCutoff { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
