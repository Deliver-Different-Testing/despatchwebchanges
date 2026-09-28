using DespatchWeb.Constants;
using DespatchWeb.Enums;

namespace DespatchWeb.Helpers;

/// <summary>
/// The single operational status of a job, resolved from the several fields that can each claim to
/// own it.
/// </summary>
public readonly record struct ResolvedJobStatus(int StatusId, bool IsVoid, bool IsComplete);

/// <summary>
/// Resolves one status from a job's competing status fields so no two surfaces can answer
/// differently for the same row.
/// <para>
/// Voiding owns its flag definitively — a status id can be moved off Void afterwards by a manual
/// status change, a bulk status upload or a POD — so the flag wins. A completion flag likewise beats
/// a status id that still says the job is new, but it never overwrites a status that already records
/// a specific outcome such as Undeliverable. A missing status id resolves to New, so a null can never
/// compete with a real state.
/// </para>
/// </summary>
public static class JobStatusResolver
{
    public static ResolvedJobStatus Resolve(
        int? statusId,
        bool? done,
        bool? isVoid,
        DateTime? completedTime = null)
    {
        if (isVoid == true)
        {
            return new ResolvedJobStatus((int)JobStatus.Void, IsVoid: true, IsComplete: false);
        }

        var recordsAnOutcome = statusId.HasValue && JobStatusGroups.Completed.Contains(statusId.Value);

        if ((done == true || completedTime.HasValue) && !recordsAnOutcome)
        {
            return new ResolvedJobStatus((int)JobStatus.Completed, IsVoid: false, IsComplete: true);
        }

        var resolved = statusId ?? (int)JobStatus.New;

        return new ResolvedJobStatus(
            resolved,
            resolved == (int)JobStatus.Void,
            JobStatusGroups.Completed.Contains(resolved) && resolved != (int)JobStatus.Void);
    }
}
