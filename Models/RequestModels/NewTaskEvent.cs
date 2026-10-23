namespace DespatchWeb.Models.RequestModels;

public sealed class NewTaskEvent
{
    public int EventTypeGroupTypeGroupId { get; init; }
    public Suggestion EventType { get; init; }
    public string Group { get; init; }

    public DateTime Date { get; init; }

    public int Sequence { get; init; }

    public DateTimeOffset? DueTime { get; init; }

    public Suggestion AssignTo { get; init; }
    public string Notes { get; init; }

    public bool Active { get; init; }
}
