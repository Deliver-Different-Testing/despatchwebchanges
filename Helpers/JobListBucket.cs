namespace DespatchWeb.Helpers;

/// <summary>
/// The disjoint classes the job list's stats header is folded from. <see cref="None"/> holds a voided
/// job, and one with a courier that isn't yet underway — both count towards Total and Active only.
/// </summary>
public enum JobListBucket
{
    None = 0,
    Unassigned = 1,
    Transit = 2,
    Done = 3
}
