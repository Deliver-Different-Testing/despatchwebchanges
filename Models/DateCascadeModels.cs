#nullable enable
namespace DespatchWeb.Models;

/// <summary>
/// One member of a job family as offered to the "apply date to linked jobs?" dialog.
/// Non-cascadable members are still returned so the dialog can show the user what will
/// NOT move and why.
/// </summary>
public sealed record DateCascadeFamilyMember(
    int JobId,
    string? JobNumber,
    DateTime? Date,
    DateTime? Time,
    decimal? Amount,
    bool RatedManually,
    bool Locked,
    bool IsPartnerJob)
{
    /// <summary>
    /// Locked legs were deliberately frozen; partner legs have their own change-request
    /// policy that a direct write would bypass. Both are display-only.
    /// </summary>
    public bool Cascadable => !Locked && !IsPartnerJob;
}

/// <summary>
/// The cascadable family of a parent job, plus the parent's relationship type so the
/// caller can describe the family accurately.
/// </summary>
public sealed record DateCascadeFamily(
    int? RelationshipTypeId,
    IReadOnlyList<DateCascadeFamilyMember> Members)
{
    public static DateCascadeFamily Empty { get; } = new(null, []);
}

/// <summary>
/// Outcome of a date cascade. A child failing must not strand the rest, so both the
/// successes and the failures are reported back for the UI to surface.
/// </summary>
public sealed record DateCascadeResult(
    IReadOnlyList<int> UpdatedJobIds,
    IReadOnlyList<int> FailedJobIds)
{
    public static DateCascadeResult Empty { get; } = new([], []);
}
