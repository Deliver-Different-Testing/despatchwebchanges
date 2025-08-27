namespace DespatchWeb.Models;

public class InternalStatus
{
    public int Id { get; set; }

    public string Text { get; set; }

    public string DefaultSchedule { get; set; }

    public int? DefaultMins { get; set; }
}