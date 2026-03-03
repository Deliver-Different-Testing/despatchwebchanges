namespace DespatchWeb.Models;

public class InternalStatus
{
    public int Id { get; init; }

    public string Text { get; init; }

    public string DefaultSchedule { get; init; }

    public int? DefaultMins { get; init; }
}