using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;
using TimeZone = DespatchWeb.EntityClasses.TimeZone;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.UpdatePodDetailsAsync — the full POD completion flow.
/// Covers active jobs, archived jobs, already-done jobs, parent/sibling completion,
/// and POD field overwrite scenarios.
/// Uses SQLite in-memory database with shared connection for parallel context queries.
/// </summary>
public class JobRepositoryUpdatePodDetailsTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly ICreateJobService _createJobServiceMock = Substitute.For<ICreateJobService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryUpdatePodDetailsTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone().Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.IsUsTenant().Returns(false);
        _tenantInfoServiceMock.GetStaffId().Returns(1);
        _tenantInfoServiceMock.GetCurrentTimeFromTimeZone(Arg.Any<TimeZone>())
            .Returns(TestDates.Now);
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        await _db.DisposeAsync();
    }

    private DespatchContext CreateContext() => _db.CreateContext();

    private JobRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _createJobServiceMock
    );

    [Fact]
    public async Task UpdatePodDetailsAsync_ActiveJob_SetsStatusPodNameAndCompletedTime()
    {
        // Arrange — seed an active job with no POD data
        const int jobId = 100;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5, // PickedUp
                UcjbPodname = null,
                UcjbComplTime = null,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(job.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, job.UcjbStatus);
            Assert.Equal("Test", job.UcjbPodname);
            Assert.NotNull(job.UcjbComplTime);
            Assert.Equal((int)InternalJobStatus.Reprice, job.InternalStatus);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_ActiveJobAlreadyDone_StillUpdatesAllFields()
    {
        // Arrange — seed a job that was already marked as done by another system (e.g. driver app)
        // with a different status and no POD name.
        // This is the core bug scenario: UcjbJobDone is true, status is "After Hours" (some non-Completed value).
        const int jobId = 200;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = true,   // Already marked done by external system
                UcjbStatus = 99,      // Some status like "After Hours"
                UcjbPodname = null,
                UcjbComplTime = null,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — all fields should be updated despite UcjbJobDone already being true
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(job.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, job.UcjbStatus); // status should be overwritten to Completed
            Assert.Equal("Test", job.UcjbPodname); // POD name should be saved even when job was already done
            Assert.NotNull(job.UcjbComplTime); // completed time should be saved even when job was already done
            Assert.Equal((int)InternalJobStatus.Reprice, job.InternalStatus);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_ActiveJobWithExistingPodData_OverwritesPodFields()
    {
        // Arrange — job has existing POD data that the user wants to correct
        const int jobId = 300;
        var oldTime = new DateTime(2026, 1, 1, 8, 0, 0);
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbPodname = "Old Name",
                UcjbComplTime = oldTime,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "New Name",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — new values should overwrite old ones
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.Equal("New Name", job.UcjbPodname); // should overwrite existing POD name
            Assert.NotEqual(oldTime, job.UcjbComplTime); // should overwrite existing completed time
            Assert.Equal((int)JobStatus.Completed, job.UcjbStatus);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_ArchivedJob_SetsStatusPodNameAndCompletedTime()
    {
        // Arrange — job only exists in archive table (not in TucJobs)
        const int jobId = 400;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbPodname = null,
                UcjbComplTime = null
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Archive Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(job.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, job.UcjbStatus);
            Assert.Equal("Archive Test", job.UcjbPodname);
            Assert.NotNull(job.UcjbComplTime);
            Assert.Equal((int)InternalJobStatus.Reprice, job.InternalStatus);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_ArchivedJobAlreadyDone_StillUpdatesAllFields()
    {
        // Arrange — archived job already marked done with wrong status
        const int jobId = 500;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = jobId,
                UcjbJobDone = true,
                UcjbStatus = 99,
                UcjbPodname = null,
                UcjbComplTime = null
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobArchives.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.Equal((int)JobStatus.Completed, job.UcjbStatus);
            Assert.Equal("Test", job.UcjbPodname);
            Assert.NotNull(job.UcjbComplTime);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_LastSiblingCompleted_AlsoCompletesParent()
    {
        // Arrange — parent job (ID 600) with one child (ID 601).
        // The child is the only uncompleted sibling.
        const int parentId = 600;
        const int childId = 601;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = parentId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbPodname = null,
                UcjbComplTime = null,
                UcjbVoid = false,
                UcjbSpeed = 1,
                ParentId = parentId // self-referencing, matches SplitJobService behavior
            });
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = childId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbPodname = null,
                UcjbComplTime = null,
                UcjbVoid = false,
                ParentId = parentId
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = childId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Child POD",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — both child and parent should be completed
        await using (var ctx = CreateContext())
        {
            var child = await ctx.TucJobs.FirstAsync(j => j.UcjbId == childId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(child.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, child.UcjbStatus);
            Assert.Equal("Child POD", child.UcjbPodname);

            var parent = await ctx.TucJobs.FirstAsync(j => j.UcjbId == parentId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(parent.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, parent.UcjbStatus);
            Assert.Equal("Child POD", parent.UcjbPodname);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_SiblingStillUncompleted_DoesNotCompleteParent()
    {
        // Arrange — parent with two children. Only completing one child.
        const int parentId = 700;
        const int child1Id = 701;
        const int child2Id = 702;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = parentId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false,
                UcjbSpeed = 1,
                ParentId = parentId // self-referencing, matches SplitJobService behavior
            });
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = child1Id,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false,
                ParentId = parentId
            });
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = child2Id,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false,
                ParentId = parentId
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = child1Id,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Child 1 POD",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — child1 completed, but parent should NOT be completed (child2 still open)
        await using (var ctx = CreateContext())
        {
            var child1 = await ctx.TucJobs.FirstAsync(j => j.UcjbId == child1Id, cancellationToken: TestContext.Current.CancellationToken);
            Assert.True(child1.UcjbJobDone);
            Assert.Equal((int)JobStatus.Completed, child1.UcjbStatus);

            var parent = await ctx.TucJobs.FirstAsync(j => j.UcjbId == parentId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.False(parent.UcjbJobDone); // parent should not be done while sibling is uncompleted
            Assert.Equal(5, parent.UcjbStatus); // parent status should be unchanged
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_PodTimeWithTimezoneOffset_ParsesCorrectly()
    {
        // Arrange — this tests the exact payload from the bug report
        const int jobId = 800;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — time should be parsed as wall-clock time (10:35:32)
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.NotNull(job.UcjbComplTime);
            Assert.Equal(10, job.UcjbComplTime!.Value.Hour);
            Assert.Equal(35, job.UcjbComplTime!.Value.Minute);
            Assert.Equal(32, job.UcjbComplTime!.Value.Second);
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_EmptyPodTime_FallsBackToCurrentTime()
    {
        // Arrange
        const int jobId = 900;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = ""
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — should use fallback time (not null)
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.NotNull(job.UcjbComplTime); // empty PodTime should fall back to current time, not null
        }
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_NonExistentJob_DoesNotThrow()
    {
        // Arrange — job ID doesn't exist in either table
        var request = new UpdatePodDetailsRequest
        {
            JobId = 99999,
            JobStatus = (int)JobStatus.Completed,
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act & Assert — should complete without error (no-op)
        await repo.UpdatePodDetailsAsync(request);
    }

    [Fact]
    public async Task UpdatePodDetailsAsync_JobStatusZero_SetsStatusToZero()
    {
        // This tests what happens if JobStatus defaults to 0 (e.g. from a deserialization bug)
        const int jobId = 1000;
        await using (var ctx = CreateContext())
        {
            ctx.TucJobs.Add(new TucJob
            {
                UcjbId = jobId,
                UcjbJobDone = false,
                UcjbStatus = 5,
                UcjbVoid = false
            });
            await ctx.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var request = new UpdatePodDetailsRequest
        {
            JobId = jobId,
            JobStatus = 0, // Default int value — could indicate a deserialization issue
            PodName = "Test",
            PodTime = "2026-03-14T10:35:32+13:00"
        };

        var repo = CreateRepository();

        // Act
        await repo.UpdatePodDetailsAsync(request);

        // Assert — status should be set to 0 (New) — this would expose a frontend bug
        await using (var ctx = CreateContext())
        {
            var job = await ctx.TucJobs.FirstAsync(j => j.UcjbId == jobId, cancellationToken: TestContext.Current.CancellationToken);
            Assert.Equal(0, job.UcjbStatus); // status should reflect exactly what was sent in the request
        }
    }

}
