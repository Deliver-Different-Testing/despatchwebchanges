using System;

namespace DespatchWeb.Models;

public class EventGroupViewModel
{
    public int EventTypeGroupTypeGroupId { get; set; }
    public Suggestion EventType { get; set; }
    public string Group { get; set; }

    public DateTime Date { get; set; }

    public int Sequence { get; set; }

    public DateTime? DueTime { get; set; }

    public Suggestion AssignTo { get; set; }
    public string Notes { get; set; }

    public bool Active { get; set; }
}
