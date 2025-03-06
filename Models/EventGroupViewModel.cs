namespace DespatchWeb.Models;

public class EventGroupViewModel
{
    public string EventType { get; set; }
    public string Group { get; set; }

    public int Sequence { get; set; }

    public int DueTime { get; set; }

    public string AssignTo { get; set; }

    public bool Active { get; set; }
}
