namespace DespatchWeb.Models;

public class LateStatusResult
{
    public bool ShouldCreateEvent { get; set; }
    public int EventType { get; set; }
    public int LateTime { get; set; }
}
