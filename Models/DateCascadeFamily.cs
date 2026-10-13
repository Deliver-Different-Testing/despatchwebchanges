#nullable enable
namespace DespatchWeb.Models;

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
