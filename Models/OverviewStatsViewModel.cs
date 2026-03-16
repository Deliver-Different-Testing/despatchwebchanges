namespace DespatchWeb.Models;

public sealed class OverviewStatsViewModel
{
    public int Active { get; init; }
    public int Inactive { get; init; }
    public int Completed { get; init; }
}