namespace DespatchWeb.Models;

public sealed class ReadTrackerInfoViewModel
{
    public bool HasBeenRead { get; set; }
    public string ReadBy { get; set; }
    public DateTime? ReadDate { get; set; }
}
