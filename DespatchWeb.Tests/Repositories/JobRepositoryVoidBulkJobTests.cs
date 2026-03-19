using DespatchWeb.Enums;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository void bulk job functionality.
/// Tests the logic for determining which bulk jobs should be voided
/// and verifies that pricing fields are cleared when voiding.
/// </summary>
public class JobRepositoryVoidBulkJobTests
{
    /// <summary>
    /// Represents a simplified bulk job structure for testing.
    /// </summary>
    private class TestBulkJob
    {
        public int BulkJobId { get; init; }
        public int? ParentBulkJobId { get; init; }
        public int JobStatus { get; set; }
        public bool Void { get; set; }
        public decimal? Amount { get; set; }
        public decimal? CourierPayment { get; set; }
    }

    /// <summary>
    /// Mimics the GetAllRelatedBulkJobIdsIncludingParentAsync logic from JobRepository.
    /// Returns all related bulk job IDs including parent and children.
    /// </summary>
    private static List<int> GetAllRelatedBulkJobIdsIncludingParent(int bulkJobId, List<TestBulkJob> allJobs)
    {
        var job = allJobs.FirstOrDefault(j => j.BulkJobId == bulkJobId);
        if (job == null)
            return [];

        List<int> relatedJobIds;
        if (job.ParentBulkJobId.HasValue)
        {
            // Get siblings (children of the same parent)
            relatedJobIds = allJobs
                .Where(j => j.ParentBulkJobId == job.ParentBulkJobId)
                .Select(j => j.BulkJobId)
                .ToList();
            relatedJobIds.Add(job.ParentBulkJobId.Value);
        }
        else
        {
            // Get children
            relatedJobIds = allJobs
                .Where(j => j.ParentBulkJobId == bulkJobId)
                .Select(j => j.BulkJobId)
                .ToList();
            relatedJobIds.Add(bulkJobId);
        }

        return relatedJobIds;
    }

    /// <summary>
    /// Mimics the GetBulkJobWithChildrenAsync logic from JobRepository.
    /// Returns the bulk job ID along with all its children IDs (if any).
    /// </summary>
    private static List<int> GetBulkJobWithChildren(int bulkJobId, List<TestBulkJob> allJobs)
    {
        var childIds = allJobs
            .Where(j => j.ParentBulkJobId == bulkJobId)
            .Select(j => j.BulkJobId)
            .ToList();

        childIds.Add(bulkJobId);
        return childIds;
    }

    /// <summary>
    /// Mimics the bulk job selection logic from VoidBulkJobAsync.
    /// </summary>
    private static List<int> DetermineBulkJobsToVoid(VoidBulkJobRequest data, List<TestBulkJob> allJobs)
    {
        if (data.SelectedJobIds is { Count: > 0 })
            return data.SelectedJobIds;

        return data.VoidSingleJobOnly
            ? GetBulkJobWithChildren(data.BulkJobId, allJobs)
            : GetAllRelatedBulkJobIdsIncludingParent(data.BulkJobId, allJobs);
    }

    /// <summary>
    /// Mimics the void update logic from VoidBulkJobAsync including pricing fields.
    /// This reflects the fix that clears Amount and CourierPayment when voiding.
    /// </summary>
    private static void ApplyVoidUpdate(List<TestBulkJob> allJobs, List<int> jobsToVoid)
    {
        foreach (var job in allJobs.Where(j => jobsToVoid.Contains(j.BulkJobId)))
        {
            job.JobStatus = (int)JobStatus.Void;
            job.Void = true;
            job.Amount = 0;
            job.CourierPayment = 0;
        }
    }

    [Fact]
    public void VoidBulkJob_ClearsPricingFields_WhenVoidingParentJob()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null, Amount = 100.50m, CourierPayment = 50.25m },
            new() { BulkJobId = 2, ParentBulkJobId = 1, Amount = 75.00m, CourierPayment = 37.50m },
            new() { BulkJobId = 3, ParentBulkJobId = 1, Amount = 25.00m, CourierPayment = 12.50m }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            VoidReason = "Test void"
        };

        // Act
        var jobsToVoid = DetermineBulkJobsToVoid(request, allJobs);
        ApplyVoidUpdate(allJobs, jobsToVoid);

        // Assert - All jobs should have pricing cleared to 0
        Assert.All(allJobs, j => Assert.Equal(0m, j.Amount));
        Assert.All(allJobs, j => Assert.Equal(0m, j.CourierPayment));
        Assert.All(allJobs, j => Assert.True(j.Void));
        Assert.All(allJobs, j => Assert.Equal((int)JobStatus.Void, j.JobStatus));
    }

    [Fact]
    public void VoidBulkJob_ClearsPricingFields_WhenVoidingSingleJob_VoidsParentAndChildren()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null, Amount = 100.50m, CourierPayment = 50.25m },
            new() { BulkJobId = 2, ParentBulkJobId = 1, Amount = 75.00m, CourierPayment = 37.50m },
            new() { BulkJobId = 3, ParentBulkJobId = null, Amount = 200.00m, CourierPayment = 100.00m } // Unrelated
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = true,
            VoidReason = "Test void single"
        };

        // Act
        var jobsToVoid = DetermineBulkJobsToVoid(request, allJobs);
        ApplyVoidUpdate(allJobs, jobsToVoid);

        // Assert - Parent and child should be voided with pricing cleared
        var parentJob = allJobs.First(j => j.BulkJobId == 1);
        var childJob = allJobs.First(j => j.BulkJobId == 2);
        var unrelatedJob = allJobs.First(j => j.BulkJobId == 3);

        Assert.Equal(0m, parentJob.Amount);
        Assert.Equal(0m, parentJob.CourierPayment);
        Assert.True(parentJob.Void);

        Assert.Equal(0m, childJob.Amount);
        Assert.Equal(0m, childJob.CourierPayment);
        Assert.True(childJob.Void);

        // Unrelated job should remain unchanged
        Assert.Equal(200.00m, unrelatedJob.Amount);
        Assert.Equal(100.00m, unrelatedJob.CourierPayment);
        Assert.False(unrelatedJob.Void);
    }

    [Fact]
    public void VoidBulkJob_ClearsPricingFields_WhenVoidingChildJob()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null, Amount = 100.50m, CourierPayment = 50.25m },
            new() { BulkJobId = 2, ParentBulkJobId = 1, Amount = 75.00m, CourierPayment = 37.50m },
            new() { BulkJobId = 3, ParentBulkJobId = 1, Amount = 25.00m, CourierPayment = 12.50m }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 2,
            VoidSingleJobOnly = false,  // This will void parent and all siblings
            VoidReason = "Test void from child"
        };

        // Act
        var jobsToVoid = DetermineBulkJobsToVoid(request, allJobs);
        ApplyVoidUpdate(allJobs, jobsToVoid);

        // Assert - All related jobs should have pricing cleared
        Assert.All(allJobs, j => Assert.Equal(0m, j.Amount));
        Assert.All(allJobs, j => Assert.Equal(0m, j.CourierPayment));
    }

    [Fact]
    public void VoidBulkJob_ClearsPricingFields_WithNullAmounts()
    {
        // Arrange - Jobs with null amounts should also be set to 0
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null, Amount = null, CourierPayment = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1, Amount = 50.00m, CourierPayment = null }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            VoidReason = "Test void with nulls"
        };

        // Act
        var jobsToVoid = DetermineBulkJobsToVoid(request, allJobs);
        ApplyVoidUpdate(allJobs, jobsToVoid);

        // Assert - All amounts should be 0 (not null)
        Assert.All(allJobs, j => Assert.Equal(0m, j.Amount));
        Assert.All(allJobs, j => Assert.Equal(0m, j.CourierPayment));
    }

    [Fact]
    public void VoidBulkJob_SelectedJobIds_OnlyClearsPricingForSelectedJobs()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null, Amount = 100.00m, CourierPayment = 50.00m },
            new() { BulkJobId = 2, ParentBulkJobId = 1, Amount = 75.00m, CourierPayment = 37.50m },
            new() { BulkJobId = 3, ParentBulkJobId = 1, Amount = 25.00m, CourierPayment = 12.50m }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            SelectedJobIds = [2], // Only void child 2
            VoidReason = "Test void selected"
        };

        // Act
        var jobsToVoid = DetermineBulkJobsToVoid(request, allJobs);
        ApplyVoidUpdate(allJobs, jobsToVoid);

        // Assert - Only selected job should be voided with pricing cleared
        var job1 = allJobs.First(j => j.BulkJobId == 1);
        var job2 = allJobs.First(j => j.BulkJobId == 2);
        var job3 = allJobs.First(j => j.BulkJobId == 3);

        Assert.Equal(100.00m, job1.Amount);
        Assert.Equal(50.00m, job1.CourierPayment);
        Assert.False(job1.Void);

        Assert.Equal(0m, job2.Amount);
        Assert.Equal(0m, job2.CourierPayment);
        Assert.True(job2.Void);

        Assert.Equal(25.00m, job3.Amount);
        Assert.Equal(12.50m, job3.CourierPayment);
        Assert.False(job3.Void);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidSingleJobOnly_ParentWithChildren_ReturnsParentAndChildren()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 },
            new() { BulkJobId = 4, ParentBulkJobId = null } // Unrelated job
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Parent and children should be returned, but not unrelated jobs
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.DoesNotContain(4, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidSingleJobOnly_JobWithNoChildren_ReturnsOnlyTargetJob()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = null } // Unrelated job
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Only the single job (no children exist)
        Assert.Single(result);
        Assert.Contains(1, result);
        Assert.DoesNotContain(2, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidSingleJobOnly_ChildJob_ReturnsOnlyChildJob()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 2, // Voiding a child job
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Only the child job (no children of its own), not parent or siblings
        Assert.Single(result);
        Assert.Contains(2, result);
        Assert.DoesNotContain(1, result);
        Assert.DoesNotContain(3, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidAllRelated_ParentJob_ReturnsParentAndChildren()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 },
            new() { BulkJobId = 4, ParentBulkJobId = null } // Unrelated job
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.DoesNotContain(4, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidAllRelated_ChildJob_ReturnsParentAndAllSiblings()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 2, // Voiding a child job
            VoidSingleJobOnly = false
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Parent and all siblings should be included
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_SelectedJobIdsProvided_UsesSelectedJobIds()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            SelectedJobIds = [2, 3] // Only void specific children
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Only selected jobs should be returned
        Assert.Equal(2, result.Count);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.DoesNotContain(1, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_EmptySelectedJobIds_FallsBackToLegacyBehavior()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 }
        };

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 1,
            VoidSingleJobOnly = false,
            SelectedJobIds = [] // Empty list
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Falls back to VoidSingleJobOnly behavior
        Assert.Equal(2, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
    }

    [Fact]
    public void DetermineBulkJobsToVoid_VoidSingleJobOnly_ParentWithManyChildren_VoidsAll()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 100, ParentBulkJobId = null }
        };

        // Add 50 children
        for (var i = 1; i <= 50; i++) allJobs.Add(new TestBulkJob { BulkJobId = i, ParentBulkJobId = 100 });

        var request = new VoidBulkJobRequest
        {
            BulkJobId = 100,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineBulkJobsToVoid(request, allJobs);

        // Assert - Parent and all 50 children should be voided
        Assert.Equal(51, result.Count);
        Assert.Contains(100, result);
        for (var i = 1; i <= 50; i++) Assert.Contains(i, result);
    }

    [Fact]
    public void GetBulkJobWithChildren_ParentWithChildren_ReturnsParentAndChildren()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 }
        };

        // Act
        var result = GetBulkJobWithChildren(1, allJobs);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
    }

    [Fact]
    public void GetBulkJobWithChildren_JobWithNoChildren_ReturnsOnlyJobId()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = null }
        };

        // Act
        var result = GetBulkJobWithChildren(1, allJobs);

        // Assert
        Assert.Single(result);
        Assert.Contains(1, result);
    }

    [Fact]
    public void GetBulkJobWithChildren_ChildJob_ReturnsOnlyChildId()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },
            new() { BulkJobId = 2, ParentBulkJobId = 1 },
            new() { BulkJobId = 3, ParentBulkJobId = 1 }
        };

        // Act - Getting children of a child job (which has no children)
        var result = GetBulkJobWithChildren(2, allJobs);

        // Assert
        Assert.Single(result);
        Assert.Contains(2, result);
    }

    [Fact]
    public void GetBulkJobWithChildren_DoesNotIncludeSiblings()
    {
        // Arrange
        var allJobs = new List<TestBulkJob>
        {
            new() { BulkJobId = 1, ParentBulkJobId = null },  // Parent
            new() { BulkJobId = 2, ParentBulkJobId = 1 },     // Child 1
            new() { BulkJobId = 3, ParentBulkJobId = 1 },     // Child 2
            new() { BulkJobId = 10, ParentBulkJobId = null },  // Another parent
            new() { BulkJobId = 11, ParentBulkJobId = 10 } // Unrelated child
        };

        // Act
        var result = GetBulkJobWithChildren(1, allJobs);

        // Assert - Only parent 1 and its children, not other families
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.DoesNotContain(10, result);
        Assert.DoesNotContain(11, result);
    }

}
