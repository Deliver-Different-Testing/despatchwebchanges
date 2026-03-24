namespace DespatchWeb.Models;

public sealed class TaskViewModel
{
    public int Id { get; init; }

    public string Title { get; init; }

    public string Description { get; init; }

    public DateTimeOffset DueDate { get; set; }

    public bool Closed { get; init; }
    
    public Suggestion Assignee { get; init; }

    public string EventType { get; init; }

    public int JobId { get; init; }
    
    public string JobNumber { get; init; }

    public string CourierCode { get; init; }

    public string CourierName { get; init; }
}
