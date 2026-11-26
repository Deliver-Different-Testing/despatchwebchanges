using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for the Locked edit path in JobRepository.EditOperations.
/// Verifies that toggling a job's locked flag works for both live jobs
/// (TucJob.UcjbLocked is a bool?) and archived jobs (TucJobArchive.UcjbLocked
/// is an int?, stored as 1/0). Regression cover for the archived-job 500
/// caused by int.Parse("true").
/// </summary>
public class JobRepositoryEditLockedTests : JobRepositoryTestBase
{

    public JobRepositoryEditLockedTests() : base(1)
    {
    }

    [Fact]
    public async Task UpdateJobAsync_Locked_ArchivedJob_SetsLockedToOne()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 1,
                UcjbNumber = "JOB-001",
                UcjbLocked = 0
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act — the frontend sends the boolean serialized as "true"
        await repository.UpdateJobAsync(1, JobProperty.Locked, "true");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 1, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(1, updatedArchive.UcjbLocked); // archived locked flag stored as 1
    }

    [Fact]
    public async Task UpdateJobAsync_Locked_ArchivedJob_Unlock_SetsLockedToZero()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.Add(new TucJobArchive
            {
                UcjbId = 2,
                UcjbNumber = "JOB-002",
                UcjbLocked = 1
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(2, JobProperty.Locked, "false");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedArchive = await verifyContext.TucJobArchives.FirstAsync(j => j.UcjbId == 2, cancellationToken: TestContext.Current.CancellationToken);

        Assert.Equal(0, updatedArchive.UcjbLocked); // archived unlocked flag stored as 0
    }

    [Fact]
    public async Task UpdateJobAsync_Locked_LiveJob_SetsLockedTrue()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 3,
                UcjbNumber = "JOB-003",
                UcjbLocked = false
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        await repository.UpdateJobAsync(3, JobProperty.Locked, "true");

        // Assert
        await using var verifyContext = CreateContext();
        var updatedJob = await verifyContext.TucJobs.FirstAsync(j => j.UcjbId == 3, cancellationToken: TestContext.Current.CancellationToken);

        Assert.True(updatedJob.UcjbLocked); // live locked flag stored as bool true
    }
}
