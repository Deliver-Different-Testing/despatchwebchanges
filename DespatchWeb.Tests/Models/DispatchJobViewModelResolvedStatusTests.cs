using DespatchWeb.Enums;
using DespatchWeb.Models;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Models;

/// <summary>
/// Every list, grid and detail surface reads its status off the view model, so the resolved status has
/// to live there rather than being re-derived per screen. These tests pin the wiring — including the
/// bulk case, where a released row used to report the live job's Done flag as if it had been delivered.
/// </summary>
[TestSubject(typeof(DispatchJobViewModel))]
public class DispatchJobViewModelResolvedStatusTests
{
    [Fact]
    public void ResolvedStatusId_VoidedJobWhoseStatusWasMovedOff_ReportsVoid()
    {
        var job = new JobViewModel { StatusId = (int)JobStatus.New, Void = true };

        Assert.Equal((int)JobStatus.Void, job.ResolvedStatusId);
        Assert.True(job.ResolvedIsVoid);
        Assert.False(job.ResolvedIsComplete);
    }

    [Fact]
    public void ResolvedStatusId_DeliveredJobStillMarkedNew_ReportsCompleted()
    {
        var job = new JobViewModel { StatusId = (int)JobStatus.New, Done = true };

        Assert.Equal((int)JobStatus.Completed, job.ResolvedStatusId);
        Assert.True(job.ResolvedIsComplete);
    }

    [Fact]
    public void ResolvedStatusId_CompletionTimeWithoutTheDoneFlag_ReportsCompleted()
    {
        var job = new JobViewModel { StatusId = (int)JobStatus.New, CompletedTime = TestDates.Now };

        Assert.Equal((int)JobStatus.Completed, job.ResolvedStatusId);
        Assert.True(job.ResolvedIsComplete);
    }

    [Fact]
    public void ResolvedStatusId_MissingStatusId_ReportsNewRatherThanNothing()
    {
        var job = new JobViewModel();

        Assert.Equal((int)JobStatus.New, job.ResolvedStatusId);
    }

    [Fact]
    public void ResolvedStatusId_ReleasedBulkRowThatWasNeverDelivered_StaysOnItsOwnStatus()
    {
        // Released means the row has been pushed to live dispatch, not that the freight arrived.
        var job = new JobViewModel
        {
            IsBulkJob = true,
            Released = true,
            Done = false,
            StatusId = (int)JobStatus.New
        };

        Assert.Equal((int)JobStatus.New, job.ResolvedStatusId);
        Assert.False(job.ResolvedIsComplete);
    }
}
