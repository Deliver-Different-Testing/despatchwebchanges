namespace DespatchWeb.Models;

public sealed class TaskViewModel
{
    public int Id { get; init; }

    public string Title { get; init; }

    public string Description { get; init; }

    public DateTimeOffset DueDate { get; set; }

    /// <summary>When the task was created (sent), in tenant time; null when the row carries no creation time.</summary>
    public DateTimeOffset? CreatedAt { get; set; }

    [Newtonsoft.Json.JsonIgnore]
    public DateTime? CreatedAtUtc { get; init; }

    /// <summary>Server-side only: legacy tenant wall-clock creation date/time for rows predating <see cref="CreatedAtUtc"/>.</summary>
    [Newtonsoft.Json.JsonIgnore]
    public DateTime? CreatedDate { get; init; }

    [Newtonsoft.Json.JsonIgnore]
    public DateTime? CreatedTime { get; init; }

    public bool Closed { get; init; }
    
    public Suggestion Assignee { get; init; }

    public string EventType { get; init; }

    public int JobId { get; set; }

    public string JobNumber { get; set; }

    /// <summary>Server-side only: the job number stored on the event, used to link an event that has no job id.</summary>
    [Newtonsoft.Json.JsonIgnore]
    public string StoredJobNumber { get; init; }

    [Newtonsoft.Json.JsonIgnore]
    public int? ClientId { get; init; }

    public string CourierCode { get; init; }

    public string CourierName { get; init; }

    public string ClientCode { get; init; }
}
