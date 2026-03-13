using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.UpdatePodDetailsAsync — the full POD completion flow.
/// Covers active jobs, archived jobs, already-done jobs, parent/sibling completion,
/// and POD field overwrite scenarios.
/// Uses SQLite in-memory database with shared connection for parallel context queries.
/// </summary>
public class JobRepositoryUpdatePodDetailsTests : IAsyncDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    public JobRepositoryUpdatePodDetailsTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _connection.CreateFunction("getdate", () => TestDates.Now);
        _connection.CreateFunction("getutcdate", () => DateTime.UtcNow);

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        _contextFactoryMock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));

        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
        _tenantInfoServiceMock.Setup(x => x.GetStaffId()).Returns(1);
        _tenantInfoServiceMock
            .Setup(x => x.GetCurrentTimeFromTimeZone(It.IsAny<EntityClasses.TimeZone>()))
            .Returns(TestDates.Now);
    }

    public async ValueTask DisposeAsync()
    {
        await _connection.DisposeAsync();
    }

    private DespatchContext CreateContext() => new(_contextOptions);

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    #region Active Job Tests

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
            job.UcjbJobDone.Should().BeTrue();
            job.UcjbStatus.Should().Be((int)JobStatus.Completed);
            job.UcjbPodname.Should().Be("Test");
            job.UcjbComplTime.Should().NotBeNull();
            job.InternalStatus.Should().Be((int)InternalJobStatus.Reprice);
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
            job.UcjbJobDone.Should().BeTrue();
            job.UcjbStatus.Should().Be((int)JobStatus.Completed, "status should be overwritten to Completed");
            job.UcjbPodname.Should().Be("Test", "POD name should be saved even when job was already done");
            job.UcjbComplTime.Should().NotBeNull("completed time should be saved even when job was already done");
            job.InternalStatus.Should().Be((int)InternalJobStatus.Reprice);
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
            job.UcjbPodname.Should().Be("New Name", "should overwrite existing POD name");
            job.UcjbComplTime.Should().NotBe(oldTime, "should overwrite existing completed time");
            job.UcjbStatus.Should().Be((int)JobStatus.Completed);
        }
    }

    #endregion

    #region Archived Job Tests

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
            job.UcjbJobDone.Should().BeTrue();
            job.UcjbStatus.Should().Be((int)JobStatus.Completed);
            job.UcjbPodname.Should().Be("Archive Test");
            job.UcjbComplTime.Should().NotBeNull();
            job.InternalStatus.Should().Be((int)InternalJobStatus.Reprice);
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
            job.UcjbStatus.Should().Be((int)JobStatus.Completed);
            job.UcjbPodname.Should().Be("Test");
            job.UcjbComplTime.Should().NotBeNull();
        }
    }

    #endregion

    #region Parent Job Completion Tests

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
                ParentId = null
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
            child.UcjbJobDone.Should().BeTrue();
            child.UcjbStatus.Should().Be((int)JobStatus.Completed);
            child.UcjbPodname.Should().Be("Child POD");

            var parent = await ctx.TucJobs.FirstAsync(j => j.UcjbId == parentId, cancellationToken: TestContext.Current.CancellationToken);
            parent.UcjbJobDone.Should().BeTrue();
            parent.UcjbStatus.Should().Be((int)JobStatus.Completed);
            parent.UcjbPodname.Should().Be("Child POD");
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
                ParentId = null
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
            child1.UcjbJobDone.Should().BeTrue();
            child1.UcjbStatus.Should().Be((int)JobStatus.Completed);

            var parent = await ctx.TucJobs.FirstAsync(j => j.UcjbId == parentId, cancellationToken: TestContext.Current.CancellationToken);
            parent.UcjbJobDone.Should().BeFalse("parent should not be done while sibling is uncompleted");
            parent.UcjbStatus.Should().Be(5, "parent status should be unchanged");
        }
    }

    #endregion

    #region POD Time Parsing Tests

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
            job.UcjbComplTime.Should().NotBeNull();
            job.UcjbComplTime!.Value.Hour.Should().Be(10);
            job.UcjbComplTime!.Value.Minute.Should().Be(35);
            job.UcjbComplTime!.Value.Second.Should().Be(32);
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
            job.UcjbComplTime.Should().NotBeNull("empty PodTime should fall back to current time, not null");
        }
    }

    #endregion

    #region Edge Cases

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
        var act = () => repo.UpdatePodDetailsAsync(request);
        await act.Should().NotThrowAsync();
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
            job.UcjbStatus.Should().Be(0, "status should reflect exactly what was sent in the request");
        }
    }

    #endregion
}
