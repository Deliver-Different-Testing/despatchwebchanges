namespace DespatchWeb.Helpers;

/// <summary>
/// Which column of the job list's stats header a job falls under. A voided job belongs to none of
/// them — it is counted in the total and nowhere else.
/// </summary>
public enum JobListBucket
{
    None = 0,
    Active = 1,
    Transit = 2,
    Done = 3
}
