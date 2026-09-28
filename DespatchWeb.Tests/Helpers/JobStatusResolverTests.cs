using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using JetBrains.Annotations;

namespace DespatchWeb.Tests.Helpers;

/// <summary>
/// A job carries several fields that each claim to own its status — a status id, a done flag, a void
/// flag and a completion timestamp — and they routinely disagree. These tests pin the precedence that
/// every surface and the bulk release guard resolve through, so the same row can never report two
/// different operational states.
/// </summary>
[TestSubject(typeof(JobStatusResolver))]
public class JobStatusResolverTests
{
    [Fact]
    public void Resolve_VoidFlagSet_BeatsAnyStatusId()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.New, done: false, isVoid: true);

        Assert.Equal((int)JobStatus.Void, resolved.StatusId);
        Assert.True(resolved.IsVoid);
        Assert.False(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_VoidFlagSet_BeatsTheDoneFlag()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.Completed, done: true, isVoid: true);

        Assert.Equal((int)JobStatus.Void, resolved.StatusId);
        Assert.True(resolved.IsVoid);
        Assert.False(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_VoidStatusIdWithoutTheFlag_StillResolvesAsVoid()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.Void, done: false, isVoid: false);

        Assert.Equal((int)JobStatus.Void, resolved.StatusId);
        Assert.True(resolved.IsVoid);
        Assert.False(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_DoneFlagSet_BeatsAStatusIdThatStillSaysNew()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.New, done: true, isVoid: false);

        Assert.Equal((int)JobStatus.Completed, resolved.StatusId);
        Assert.True(resolved.IsComplete);
        Assert.False(resolved.IsVoid);
    }

    [Fact]
    public void Resolve_CompletionTimeWithoutTheDoneFlag_StillResolvesAsCompleted()
    {
        var resolved = JobStatusResolver.Resolve(
            (int)JobStatus.New,
            done: false,
            isVoid: false,
            completedTime: TestDates.Now);

        Assert.Equal((int)JobStatus.Completed, resolved.StatusId);
        Assert.True(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_DoneFlagSet_DoesNotOverwriteUndeliverable()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.Undeliverable, done: true, isVoid: false);

        Assert.Equal((int)JobStatus.Undeliverable, resolved.StatusId);
        Assert.True(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_NullStatusId_ResolvesToNewRatherThanNothing()
    {
        var resolved = JobStatusResolver.Resolve(null, done: false, isVoid: false);

        Assert.Equal((int)JobStatus.New, resolved.StatusId);
        Assert.False(resolved.IsVoid);
        Assert.False(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_NullFlagsWithAPopulatedStatusId_KeepsThatStatus()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.InTransit, done: null, isVoid: null);

        Assert.Equal((int)JobStatus.InTransit, resolved.StatusId);
        Assert.False(resolved.IsVoid);
        Assert.False(resolved.IsComplete);
    }

    [Fact]
    public void Resolve_CompletedStatusIdWithoutTheDoneFlag_IsStillComplete()
    {
        var resolved = JobStatusResolver.Resolve((int)JobStatus.Completed, done: false, isVoid: false);

        Assert.Equal((int)JobStatus.Completed, resolved.StatusId);
        Assert.True(resolved.IsComplete);
    }
}
