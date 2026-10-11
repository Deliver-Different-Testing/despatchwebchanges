namespace DespatchWeb.Helpers;

/// <summary>
/// The status fields the job list's stats header counts by, narrowed to the columns the buckets
/// actually read so the aggregate can project straight out of SQL.
/// </summary>
public readonly record struct JobStatusSnapshot(
    int? StatusId,
    bool Done,
    bool Void,
    DateTime? CompletedTime,
    bool HasCourier);
