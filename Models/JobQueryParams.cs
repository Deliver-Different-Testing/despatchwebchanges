using System;

namespace DespatchWeb.Models;

public class JobQueryParams
{
    public DateTimeOffset? DateCutoff { get; set; }
    public DateTimeOffset? StartDate { get; set; }
    public DateTimeOffset? EndDate { get; set; }
}
