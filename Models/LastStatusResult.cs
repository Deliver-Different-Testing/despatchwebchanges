namespace DespatchWeb.Models;

public class LateStatusResult
{
    public bool ShouldCreateEvent { get; init; }
    public int EventType { get; init; }
    public int LateTime { get; init; }
}
