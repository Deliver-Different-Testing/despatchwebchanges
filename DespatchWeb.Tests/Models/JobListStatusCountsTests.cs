using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Models;

/// <summary>
/// The lists that already hold every match in memory — the bulk list pages its own deduped set —
/// count the stats header from those rows rather than asking the database a second time. These
/// tests pin that the in-memory tally answers the same four numbers as the grouped one.
/// </summary>
[TestSubject(typeof(JobListStatusCounts))]
public class JobListStatusCountsTests
{
    [Fact]
    public void FromJobs_CountsEachBucketAndTotalsEverything()
    {
        var jobs = new[]
        {
            Job(JobStatus.New),
            Job(JobStatus.New),
            Job(JobStatus.InTransit, courier: "CR1"),
            Job(JobStatus.Completed),
            Job(JobStatus.New, isVoid: true)
        };

        var counts = JobListStatusCounts.FromJobs(jobs);

        Assert.Equal(5, counts.Total);
        Assert.Equal(2, counts.Active);
        Assert.Equal(1, counts.Transit);
        Assert.Equal(1, counts.Done);
    }

    [Fact]
    public void FromJobs_AssignedJob_IsNotActive()
    {
        var counts = JobListStatusCounts.FromJobs([Job(JobStatus.New, courier: "CR1")]);

        Assert.Equal(1, counts.Total);
        Assert.Equal(0, counts.Active);
    }

    [Fact]
    public void FromJobs_NoJobs_IsAllZeroes()
    {
        var counts = JobListStatusCounts.FromJobs([]);

        Assert.Equal(0, counts.Total);
        Assert.Equal(0, counts.Active);
        Assert.Equal(0, counts.Transit);
        Assert.Equal(0, counts.Done);
    }

    [Fact]
    public void FromJobs_AgreesWithTheGroupedTally()
    {
        var jobs = new[]
        {
            Job(JobStatus.New),
            Job(JobStatus.Dispatched, courier: "CR1"),
            Job(JobStatus.Undeliverable),
            Job(JobStatus.New, done: true),
            Job(JobStatus.Completed, isVoid: true)
        };

        var grouped = JobListStatusCounts.FromBuckets(
            jobs.GroupBy(j => JobListStatusBuckets.Classify(JobStatusSnapshots.Of(j)))
                .Select(g => new JobListBucketTally(g.Key, g.Count()))
                .ToList());

        Assert.Equal(grouped, JobListStatusCounts.FromJobs(jobs));
    }

    private static DispatchJobViewModel Job(
        JobStatus status, bool done = false, bool isVoid = false, string courier = null) =>
        new()
        {
            StatusId = (int)status,
            Done = done,
            Void = isVoid,
            Courier = courier
        };
}
