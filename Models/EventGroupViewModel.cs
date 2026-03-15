namespace DespatchWeb.Models;

public class EventGroupViewModel
{
    public int EventTypeGroupTypeGroupId { get; init; }
    public Suggestion EventType { get; init; }
    public string Group { get; init; }

    public DateTime Date { get; init; }

    public int Sequence { get; init; }

    public DateTime? DueTime { get; init; }

    public Suggestion AssignTo { get; init; }
    public string Notes { get; init; }

    public bool Active { get; init; }
}
