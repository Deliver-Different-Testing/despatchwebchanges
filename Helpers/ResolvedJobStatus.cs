namespace DespatchWeb.Helpers;

/// <summary>
/// The single operational status of a job, resolved from the several fields that can each claim to
/// own it.
/// </summary>
public readonly record struct ResolvedJobStatus(int StatusId, bool IsVoid, bool IsComplete);
