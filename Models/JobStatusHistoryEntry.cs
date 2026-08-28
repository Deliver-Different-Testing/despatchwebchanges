namespace DespatchWeb.Models;

/// <summary>A single job-status transition, in tenant-local time.</summary>
public readonly record struct JobStatusHistoryEntry(string Status, DateTimeOffset ActionTime);
