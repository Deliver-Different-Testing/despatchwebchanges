using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// The job list's stats header sorts every matching job into one of three buckets. The counting now
/// happens in SQL, so the rule lives as an expression tree rather than as a method — these tests
/// drive its compiled form, and the parity tests at the bottom hold it against
/// <see cref="JobStatusResolver"/> so the two answers for a row can never diverge.
/// </summary>
[TestSubject(typeof(JobListStatusBuckets))]
public class JobListStatusBucketsTests
{
    private static bool IsDone(JobStatusSnapshot s) => JobListStatusBuckets.Classify(s) == JobListBucket.Done;
    private static bool IsInTransit(JobStatusSnapshot s) => JobListStatusBuckets.Classify(s) == JobListBucket.Transit;
    private static bool IsActive(JobStatusSnapshot s) => JobListStatusBuckets.Classify(s) == JobListBucket.Active;

    private static JobStatusSnapshot Snapshot(
        JobStatus? status = null,
        bool done = false,
        bool isVoid = false,
        DateTime? completedTime = null,
        bool hasCourier = false) =>
        new((int?)status, done, isVoid, completedTime, hasCourier);

    // ── Done ─────────────────────────────────────────────────────────────

    [Fact]
    public void IsDone_CompletedStatus_Counts()
    {
        Assert.True(IsDone(Snapshot(JobStatus.Completed)));
    }

    [Fact]
    public void IsDone_DoneFlagOnANewJob_Counts()
    {
        Assert.True(IsDone(Snapshot(JobStatus.New, done: true)));
    }

    [Fact]
    public void IsDone_CompletionTimeAlone_Counts()
    {
        Assert.True(IsDone(Snapshot(JobStatus.New, completedTime: new DateTime(2026, 1, 1))));
    }

    [Fact]
    public void IsDone_Undeliverable_DoesNotCount()
    {
        // The header's Done is "delivered", not "finished" — the client reads resolvedStatusId ===
        // Completed exactly, and Undeliverable resolves to itself.
        Assert.False(IsDone(Snapshot(JobStatus.Undeliverable, done: true)));
    }

    [Fact]
    public void IsDone_VoidFlagBeatsACompletedStatus()
    {
        Assert.False(IsDone(Snapshot(JobStatus.Completed, isVoid: true)));
    }

    [Fact]
    public void IsDone_VoidStatusWithADoneFlag_DoesNotCount()
    {
        Assert.False(IsDone(Snapshot(JobStatus.Void, done: true)));
    }

    // ── Transit ──────────────────────────────────────────────────────────

    [Theory]
    [InlineData(JobStatus.Dispatched)]
    [InlineData(JobStatus.Accepted)]
    [InlineData(JobStatus.PickedUp)]
    [InlineData(JobStatus.InTransit)]
    public void IsInTransit_WorkingStatuses_Count(JobStatus status)
    {
        Assert.True(IsInTransit(Snapshot(status, hasCourier: true)));
    }

    [Theory]
    [InlineData(JobStatus.New)]
    [InlineData(JobStatus.Completed)]
    [InlineData(JobStatus.OutForDelivery)]
    [InlineData(JobStatus.LatePickup)]
    public void IsInTransit_OtherStatuses_DoNotCount(JobStatus status)
    {
        Assert.False(IsInTransit(Snapshot(status)));
    }

    [Fact]
    public void IsInTransit_DispatchedButFlaggedDone_CountsAsDoneInstead()
    {
        var job = Snapshot(JobStatus.Dispatched, done: true);

        Assert.False(IsInTransit(job));
        Assert.True(IsDone(job));
    }

    [Fact]
    public void IsInTransit_VoidedWhileInTransit_DoesNotCount()
    {
        Assert.False(IsInTransit(Snapshot(JobStatus.InTransit, isVoid: true, hasCourier: true)));
    }

    // ── Active ───────────────────────────────────────────────────────────

    [Fact]
    public void IsActive_UnassignedNewJob_Counts()
    {
        Assert.True(IsActive(Snapshot(JobStatus.New)));
    }

    [Fact]
    public void IsActive_NoStatusAtAll_CountsAsNew()
    {
        Assert.True(IsActive(Snapshot()));
    }

    [Fact]
    public void IsActive_JobWithACourier_DoesNotCount()
    {
        Assert.False(IsActive(Snapshot(JobStatus.New, hasCourier: true)));
    }

    [Fact]
    public void IsActive_VoidedUnassignedJob_DoesNotCount()
    {
        Assert.False(IsActive(Snapshot(JobStatus.New, isVoid: true)));
    }

    [Fact]
    public void IsActive_DeliveredUnassignedJob_DoesNotCount()
    {
        Assert.False(IsActive(Snapshot(JobStatus.Completed)));
    }

    [Fact]
    public void IsActive_UnassignedButInTransit_DoesNotCount()
    {
        Assert.False(IsActive(Snapshot(JobStatus.InTransit)));
    }

    // ── The buckets never overlap ────────────────────────────────────────

    [Fact]
    public void Classify_AssignedButNotYetDispatched_LandsInNoBucket()
    {
        // Counted in the total and nowhere else — it is neither waiting for a courier nor moving.
        Assert.Equal(JobListBucket.None, JobListStatusBuckets.Classify(Snapshot(JobStatus.Preassigned, hasCourier: true)));
    }

    // ── Parity with the resolver every other surface reads ───────────────

    [Fact]
    public void Buckets_AgreeWithTheJobStatusResolver()
    {
        int[] inTransit =
        [
            (int)JobStatus.Dispatched, (int)JobStatus.Accepted, (int)JobStatus.PickedUp, (int)JobStatus.InTransit
        ];

        foreach (var snapshot in AllCombinations())
        {
            var resolved = JobStatusResolver
                .Resolve(snapshot.StatusId, snapshot.Done, snapshot.Void, snapshot.CompletedTime)
                .StatusId;

            Assert.Equal(resolved == (int)JobStatus.Completed, IsDone(snapshot));
            Assert.Equal(inTransit.Contains(resolved), IsInTransit(snapshot));
            Assert.Equal(
                !snapshot.HasCourier
                && resolved != (int)JobStatus.Completed
                && resolved != (int)JobStatus.Void
                && !inTransit.Contains(resolved),
                IsActive(snapshot));
        }
    }

    private static IEnumerable<JobStatusSnapshot> AllCombinations()
    {
        JobStatus?[] statuses =
        [
            null, JobStatus.New, JobStatus.Dispatched, JobStatus.Accepted, JobStatus.PickedUp,
            JobStatus.Completed, JobStatus.Undeliverable, JobStatus.InTransit, JobStatus.OutForDelivery,
            JobStatus.LatePickup, JobStatus.AssumingCompleted, JobStatus.Void
        ];

        foreach (var status in statuses)
        foreach (var done in new[] { false, true })
        foreach (var isVoid in new[] { false, true })
        foreach (var completedTime in new DateTime?[] { null, new DateTime(2026, 1, 1) })
        foreach (var hasCourier in new[] { false, true })
        {
            yield return Snapshot(status, done, isVoid, completedTime, hasCourier);
        }
    }
}
