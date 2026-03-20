using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository archived void job functionality.
/// Tests the logic for determining which archived jobs should be voided based on request parameters.
/// </summary>
public class JobRepositoryVoidArchivedTests
{
    /// <summary>
    /// Represents a simplified archived job structure for testing parent-child relationships.
    /// </summary>
    private class TestArchivedJob
    {
        public int Id { get; init; }
        public int? ParentId { get; init; }
    }

    /// <summary>
    /// Mimics the GetArchivedJobWithChildrenAsync logic from JobRepository.
    /// Returns the archived job ID along with all its children IDs (if any).
    /// </summary>
    private static List<int> GetArchivedJobWithChildren(int jobId, List<TestArchivedJob> allJobs)
    {
        var childIds = allJobs
            .Where(j => j.ParentId == jobId)
            .Select(j => j.Id)
            .ToList();

        childIds.Add(jobId);
        return childIds;
    }

    /// <summary>
    /// Mimics the GetAllRelatedArchivedJobIdsIncludingParentAsync logic from JobRepository.
    /// Returns all related archived job IDs including parent and siblings.
    /// </summary>
    private static List<int> GetAllRelatedArchivedJobIdsIncludingParent(int jobId, List<TestArchivedJob> allJobs)
    {
        var job = allJobs.FirstOrDefault(j => j.Id == jobId);
        if (job == null)
            return [];

        List<int> relatedJobIds;
        if (job.ParentId.HasValue)
        {
            // Get siblings (children of the same parent)
            relatedJobIds = allJobs
                .Where(j => j.ParentId == job.ParentId)
                .Select(j => j.Id)
                .ToList();
            relatedJobIds.Add(job.ParentId.Value);
        }
        else
        {
            // Get children
            relatedJobIds = allJobs
                .Where(j => j.ParentId == jobId)
                .Select(j => j.Id)
                .ToList();
            relatedJobIds.Add(jobId);
        }

        return relatedJobIds;
    }

    /// <summary>
    /// Mimics the archived job selection logic from VoidArchivedJobAsync.
    /// </summary>
    private static List<int> DetermineArchivedJobsToVoid(VoidJobRequest data, List<TestArchivedJob> allJobs)
    {
        if (data.SelectedJobIds is { Count: > 0 })
            return data.SelectedJobIds;

        return data.VoidSingleJobOnly
            ? GetArchivedJobWithChildren(data.JobId, allJobs)
            : GetAllRelatedArchivedJobIdsIncludingParent(data.JobId, allJobs);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_VoidSingleJobOnly_ParentWithChildren_VoidsParentAndAllChildren()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },  // Parent archived job
            new() { Id = 2, ParentId = 1 },     // Child 1
            new() { Id = 3, ParentId = 1 },     // Child 2
            new() { Id = 4, ParentId = 1 },     // Child 3
            new() { Id = 5, ParentId = null } // Unrelated archived job
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Parent and all children should be voided
        Assert.Equal(4, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.Contains(4, result);
        Assert.DoesNotContain(5, result); // Unrelated job should not be included
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_VoidSingleJobOnly_JobWithNoChildren_VoidsOnlySingleJob()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },  // Standalone archived job
            new() { Id = 2, ParentId = null } // Another standalone archived job
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Only the single archived job should be voided
        Assert.Single(result);
        Assert.Contains(1, result);
        Assert.DoesNotContain(2, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_VoidSingleJobOnly_ChildJob_VoidsOnlyChildJob()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },  // Parent archived job
            new() { Id = 2, ParentId = 1 },     // Child 1 (target)
            new() { Id = 3, ParentId = 1 } // Child 2 (sibling)
        };

        var request = new VoidJobRequest
        {
            JobId = 2, // Voiding a child archived job
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Only the child archived job should be voided (no children of its own)
        Assert.Single(result);
        Assert.Contains(2, result);
        Assert.DoesNotContain(1, result); // Parent and sibling not voided
        Assert.DoesNotContain(3, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_VoidAllRelated_ParentJob_VoidsParentAndAllChildren()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },  // Parent archived job
            new() { Id = 2, ParentId = 1 },     // Child 1
            new() { Id = 3, ParentId = 1 } // Child 2
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = false
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_VoidAllRelated_ChildJob_VoidsParentAndAllSiblings()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },  // Parent archived job
            new() { Id = 2, ParentId = 1 },     // Child 1 (target)
            new() { Id = 3, ParentId = 1 },     // Child 2 (sibling)
            new() { Id = 4, ParentId = 1 } // Child 3 (sibling)
        };

        var request = new VoidJobRequest
        {
            JobId = 2, // Voiding a child archived job
            VoidSingleJobOnly = false
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Parent and all siblings should be voided
        Assert.Equal(4, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.Contains(4, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_SelectedJobIdsProvided_UsesSelectedJobIds()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = 1 },
            new() { Id = 3, ParentId = 1 },
            new() { Id = 4, ParentId = 1 }
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true,
            SelectedJobIds = [2, 3] // Only void specific children
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Only selected archived jobs should be voided
        Assert.Equal(2, result.Count);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
        Assert.DoesNotContain(1, result);
        Assert.DoesNotContain(4, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_EmptySelectedJobIds_FallsBackToLegacyBehavior()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = 1 }
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true,
            SelectedJobIds = [] // Empty list
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Falls back to VoidSingleJobOnly behavior (parent + children)
        Assert.Equal(2, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_NullSelectedJobIds_FallsBackToLegacyBehavior()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = 1 }
        };

        var request = new VoidJobRequest
        {
            JobId = 1,
            VoidSingleJobOnly = true,
            SelectedJobIds = null
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Falls back to VoidSingleJobOnly behavior (parent + children)
        Assert.Equal(2, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_ParentWithManyChildren_VoidsAll()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 100, ParentId = null }
        };

        // Add 50 children
        for (var i = 1; i <= 50; i++)
        {
            allJobs.Add(new TestArchivedJob { Id = i, ParentId = 100 });
        }

        var request = new VoidJobRequest
        {
            JobId = 100,
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Parent and all 50 children should be voided
        Assert.Equal(51, result.Count);
        Assert.Contains(100, result);
        for (var i = 1; i <= 50; i++) Assert.Contains(i, result);
    }

    [Fact]
    public void DetermineArchivedJobsToVoid_JobNotInList_ReturnsJobIdOnly()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null }
        };

        var request = new VoidJobRequest
        {
            JobId = 999, // Archived job doesn't exist in the list
            VoidSingleJobOnly = true
        };

        // Act
        var result = DetermineArchivedJobsToVoid(request, allJobs);

        // Assert - Should still return the job ID (no children found)
        Assert.Single(result);
        Assert.Contains(999, result);
    }

    [Fact]
    public void GetArchivedJobWithChildren_ParentWithChildren_ReturnsParentAndChildren()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = 1 },
            new() { Id = 3, ParentId = 1 }
        };

        // Act
        var result = GetArchivedJobWithChildren(1, allJobs);

        // Assert
        Assert.Equal(3, result.Count);
        Assert.Contains(1, result);
        Assert.Contains(2, result);
        Assert.Contains(3, result);
    }

    [Fact]
    public void GetArchivedJobWithChildren_JobWithNoChildren_ReturnsOnlyJobId()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = null }
        };

        // Act
        var result = GetArchivedJobWithChildren(1, allJobs);

        // Assert
        Assert.Single(result);
        Assert.Contains(1, result);
    }

    [Fact]
    public void GetArchivedJobWithChildren_ChildJob_ReturnsOnlyChildId()
    {
        // Arrange
        var allJobs = new List<TestArchivedJob>
        {
            new() { Id = 1, ParentId = null },
            new() { Id = 2, ParentId = 1 },
            new() { Id = 3, ParentId = 1 }
        };

        // Act - Getting children of a child archived job (which has no children)
        var result = GetArchivedJobWithChildren(2, allJobs);

        // Assert
        Assert.Single(result);
        Assert.Contains(2, result);
    }

}
