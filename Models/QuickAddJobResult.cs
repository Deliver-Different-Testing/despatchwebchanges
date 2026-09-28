namespace DespatchWeb.Models;

/// <summary>
/// The outcome of a quick-add job insert: the new job's id and the job number generated for it.
/// </summary>
public sealed record QuickAddJobResult(int JobId, string JobNumber);
