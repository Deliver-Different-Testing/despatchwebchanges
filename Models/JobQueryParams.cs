using System;

namespace DespatchWeb.Models;

public class JobQueryParams
{
    public DateTime? DateCutoff { get; set; }
    public DateTime? StartDate { get; set; }
    public DateTime? EndDate { get; set; }
}
