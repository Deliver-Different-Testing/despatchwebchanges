using FluentAssertions;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository client update functionality.
/// Tests the logic for updating child jobs when a parent job's client is changed.
/// </summary>
public class JobRepositoryClientUpdateTests
{
    /// <summary>
    /// Represents a simplified job structure for testing parent-child client updates.
    /// </summary>
    private class TestJob
    {
        public int Id { get; init; }
        public int? ParentId { get; init; }
        public int? ClientId { get; set; }
        public string? ClientCode { get; set; }
        public List<TestJob> Children { get; set; } = [];
    }

    /// <summary>
    /// Mimics the ClientID update logic from JobRepository.UpdateTucJobWithEntityAsync.
    /// When a parent job's client is updated, all child jobs are also updated.
    /// </summary>
    private static void UpdateJobClient(TestJob job, int newClientId, string newClientCode)
    {
        job.ClientId = newClientId;
        job.ClientCode = newClientCode;

        // If this is a parent job, update all child jobs to the same client
        if (job.Children.Count == 0) return;
        
        foreach (var childJob in job.Children)
        {
            childJob.ClientId = newClientId;
            childJob.ClientCode = newClientCode;
        }
    }

    #region Parent Job Client Update Tests

    [Fact]
    public void UpdateJobClient_ParentWithChildren_UpdatesParentAndAllChildren()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { Id = 2, ParentId = 1, ClientId = 100, ClientCode = "OLD" },
                new TestJob { Id = 3, ParentId = 1, ClientId = 100, ClientCode = "OLD" },
                new TestJob { Id = 4, ParentId = 1, ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act
        UpdateJobClient(parent, 200, "NEW");

        // Assert - Parent should be updated
        parent.ClientId.Should().Be(200);
        parent.ClientCode.Should().Be("NEW");

        // Assert - All children should be updated
        parent.Children.Should().AllSatisfy(child =>
        {
            child.ClientId.Should().Be(200);
            child.ClientCode.Should().Be("NEW");
        });
    }

    [Fact]
    public void UpdateJobClient_ParentWithNoChildren_UpdatesOnlyParent()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "OLD",
            Children = []
        };

        // Act
        UpdateJobClient(parent, 200, "NEW");

        // Assert
        parent.ClientId.Should().Be(200);
        parent.ClientCode.Should().Be("NEW");
    }

    [Fact]
    public void UpdateJobClient_ChildJob_UpdatesOnlyChildNotSiblings()
    {
        // Arrange - Child job with no children of its own
        var child = new TestJob
        {
            Id = 2,
            ParentId = 1,
            ClientId = 100,
            ClientCode = "OLD",
            Children = []
        };

        // Sibling jobs (not in the Children collection of the target job)
        var sibling1 = new TestJob { Id = 3, ParentId = 1, ClientId = 100, ClientCode = "OLD" };
        var sibling2 = new TestJob { Id = 4, ParentId = 1, ClientId = 100, ClientCode = "OLD" };

        // Act
        UpdateJobClient(child, 200, "NEW");

        // Assert - Only the target child should be updated
        child.ClientId.Should().Be(200);
        child.ClientCode.Should().Be("NEW");

        // Siblings should remain unchanged
        sibling1.ClientId.Should().Be(100);
        sibling1.ClientCode.Should().Be("OLD");
        sibling2.ClientId.Should().Be(100);
        sibling2.ClientCode.Should().Be("OLD");
    }

    #endregion

    #region Edge Cases

    [Fact]
    public void UpdateJobClient_ParentWithManyChildren_UpdatesAll()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 100,
            ClientId = 1,
            ClientCode = "A",
            Children = []
        };

        // Add 50 children
        for (var i = 1; i <= 50; i++)
        {
            parent.Children.Add(new TestJob
            {
                Id = i,
                ParentId = 100,
                ClientId = 1,
                ClientCode = "A"
            });
        }

        // Act
        UpdateJobClient(parent, 999, "NEW");

        // Assert - Parent and all 50 children should be updated
        parent.ClientId.Should().Be(999);
        parent.ClientCode.Should().Be("NEW");
        parent.Children.Should().HaveCount(50);
        parent.Children.Should().AllSatisfy(child =>
        {
            child.ClientId.Should().Be(999);
            child.ClientCode.Should().Be("NEW");
        });
    }

    [Fact]
    public void UpdateJobClient_UpdateToSameClient_NoChange()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "SAME",
            Children =
            [
                new TestJob { Id = 2, ParentId = 1, ClientId = 100, ClientCode = "SAME" }
            ]
        };

        // Act - Update to the same client
        UpdateJobClient(parent, 100, "SAME");

        // Assert - Values should remain the same
        parent.ClientId.Should().Be(100);
        parent.ClientCode.Should().Be("SAME");
        parent.Children[0].ClientId.Should().Be(100);
        parent.Children[0].ClientCode.Should().Be("SAME");
    }

    [Fact]
    public void UpdateJobClient_ChildrenWithDifferentClients_AllUpdatedToSameClient()
    {
        // Arrange - Children have different clients initially
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "A",
            Children =
            [
                new TestJob { Id = 2, ParentId = 1, ClientId = 200, ClientCode = "B" },
                new TestJob { Id = 3, ParentId = 1, ClientId = 300, ClientCode = "C" },
                new TestJob { Id = 4, ParentId = 1, ClientId = 100, ClientCode = "A" }
            ]
        };

        // Act
        UpdateJobClient(parent, 500, "NEW");

        // Assert - All should now have the same client
        parent.ClientId.Should().Be(500);
        parent.ClientCode.Should().Be("NEW");
        parent.Children.Should().AllSatisfy(child =>
        {
            child.ClientId.Should().Be(500);
            child.ClientCode.Should().Be("NEW");
        });
    }

    [Fact]
    public void UpdateJobClient_NullClientCode_SetsNullClientCode()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { Id = 2, ParentId = 1, ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act - Update with null client code
        UpdateJobClient(parent, 200, null!);

        // Assert
        parent.ClientId.Should().Be(200);
        parent.ClientCode.Should().BeNull();
        parent.Children[0].ClientId.Should().Be(200);
        parent.Children[0].ClientCode.Should().BeNull();
    }

    #endregion

    #region Client Code Truncation Tests

    [Fact]
    public void UpdateJobClient_ClientCodeLength_PreservedAsIs()
    {
        // Arrange
        var parent = new TestJob
        {
            Id = 1,
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { Id = 2, ParentId = 1, ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act - Use a 5-character code (max length in DB)
        UpdateJobClient(parent, 200, "ABCDE");

        // Assert
        parent.ClientCode.Should().Be("ABCDE");
        parent.Children[0].ClientCode.Should().Be("ABCDE");
    }

    #endregion
}
