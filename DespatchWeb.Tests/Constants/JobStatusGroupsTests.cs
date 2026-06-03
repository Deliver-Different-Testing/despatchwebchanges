using DespatchWeb.Constants;
using DespatchWeb.Enums;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Constants;

[TestSubject(typeof(JobStatusGroups))]
public class JobStatusGroupsTests
{
    [Fact]
    public void Active_ContainsExpectedStatuses()
    {
        var expected = new[]
        {
            (int)JobStatus.Dispatched,
            (int)JobStatus.New,
            (int)JobStatus.Accepted,
            (int)JobStatus.LatePickup,
            (int)JobStatus.PickedUp,
            (int)JobStatus.Warning,
            (int)JobStatus.LateDelivery,
            (int)JobStatus.AwaitingPod,
            (int)JobStatus.InTransit,
            (int)JobStatus.Acknowledge,
            (int)JobStatus.AssumingCompleted,
            (int)JobStatus.AwaitingProcessing,
            (int)JobStatus.Preassigned,
            (int)JobStatus.Rejected,
            (int)JobStatus.ReadyForPacking,
            (int)JobStatus.ReadyToPickup,
            (int)JobStatus.OutForDelivery
        };

        Assert.Equal(expected.Length, JobStatusGroups.Active.Count);
        Assert.All(expected, status => Assert.Contains(status, JobStatusGroups.Active));
    }

    [Fact]
    public void Active_DoesNotContainCompletedStatuses()
    {
        Assert.DoesNotContain((int)JobStatus.Completed, JobStatusGroups.Active);
        Assert.DoesNotContain((int)JobStatus.Undeliverable, JobStatusGroups.Active);
        Assert.DoesNotContain((int)JobStatus.Void, JobStatusGroups.Active);
    }

    [Fact]
    public void Completed_ContainsExpectedStatuses()
    {
        var expected = new[]
        {
            (int)JobStatus.Completed,
            (int)JobStatus.Undeliverable,
            (int)JobStatus.Void
        };

        Assert.Equal(expected.Length, JobStatusGroups.Completed.Count);
        Assert.All(expected, status => Assert.Contains(status, JobStatusGroups.Completed));
    }

    [Fact]
    public void Completed_DoesNotContainActiveStatuses()
    {
        Assert.DoesNotContain((int)JobStatus.New, JobStatusGroups.Completed);
        Assert.DoesNotContain((int)JobStatus.Dispatched, JobStatusGroups.Completed);
        Assert.DoesNotContain((int)JobStatus.PickedUp, JobStatusGroups.Completed);
    }

    [Fact]
    public void Active_And_Completed_AreDisjoint()
    {
        var overlap = JobStatusGroups.Active.Intersect(JobStatusGroups.Completed).ToList();
        Assert.Empty(overlap);
    }
}
