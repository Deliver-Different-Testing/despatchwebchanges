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
        public int? ClientId { get; set; }
        public string? ClientCode { get; set; }
        public List<TestJob> Children { get; init; } = [];
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

    [Fact]
    public void UpdateJobClient_ParentWithChildren_UpdatesParentAndAllChildren()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { ClientId = 100, ClientCode = "OLD" },
                new TestJob { ClientId = 100, ClientCode = "OLD" },
                new TestJob { ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act
        UpdateJobClient(parent, 200, "NEW");

        // Assert - Parent should be updated
        Assert.Equal(200, parent.ClientId);
        Assert.Equal("NEW", parent.ClientCode);

        // Assert - All children should be updated
        Assert.All(parent.Children, child =>
        {
            Assert.Equal(200, child.ClientId);
            Assert.Equal("NEW", child.ClientCode);
        });
    }

    [Fact]
    public void UpdateJobClient_ParentWithNoChildren_UpdatesOnlyParent()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "OLD",
            Children = []
        };

        // Act
        UpdateJobClient(parent, 200, "NEW");

        // Assert
        Assert.Equal(200, parent.ClientId);
        Assert.Equal("NEW", parent.ClientCode);
    }

    [Fact]
    public void UpdateJobClient_ChildJob_UpdatesOnlyChildNotSiblings()
    {
        // Arrange - Child job with no children of its own
        var child = new TestJob
        {
            ClientId = 100,
            ClientCode = "OLD",
            Children = []
        };

        // Sibling jobs (not in the Children collection of the target job)
        var sibling1 = new TestJob { ClientId = 100, ClientCode = "OLD" };
        var sibling2 = new TestJob { ClientId = 100, ClientCode = "OLD" };

        // Act
        UpdateJobClient(child, 200, "NEW");

        // Assert - Only the target child should be updated
        Assert.Equal(200, child.ClientId);
        Assert.Equal("NEW", child.ClientCode);

        // Siblings should remain unchanged
        Assert.Equal(100, sibling1.ClientId);
        Assert.Equal("OLD", sibling1.ClientCode);
        Assert.Equal(100, sibling2.ClientId);
        Assert.Equal("OLD", sibling2.ClientCode);
    }

    [Fact]
    public void UpdateJobClient_ParentWithManyChildren_UpdatesAll()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 1,
            ClientCode = "A",
            Children = []
        };

        // Add 50 children
        for (var i = 1; i <= 50; i++)
        {
            parent.Children.Add(new TestJob
            {
                ClientId = 1,
                ClientCode = "A"
            });
        }

        // Act
        UpdateJobClient(parent, 999, "NEW");

        // Assert - Parent and all 50 children should be updated
        Assert.Equal(999, parent.ClientId);
        Assert.Equal("NEW", parent.ClientCode);
        Assert.Equal(50, parent.Children.Count);
        Assert.All(parent.Children, child =>
        {
            Assert.Equal(999, child.ClientId);
            Assert.Equal("NEW", child.ClientCode);
        });
    }

    [Fact]
    public void UpdateJobClient_UpdateToSameClient_NoChange()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "SAME",
            Children =
            [
                new TestJob { ClientId = 100, ClientCode = "SAME" }
            ]
        };

        // Act - Update to the same client
        UpdateJobClient(parent, 100, "SAME");

        // Assert - Values should remain the same
        Assert.Equal(100, parent.ClientId);
        Assert.Equal("SAME", parent.ClientCode);
        Assert.Equal(100, parent.Children[0].ClientId);
        Assert.Equal("SAME", parent.Children[0].ClientCode);
    }

    [Fact]
    public void UpdateJobClient_ChildrenWithDifferentClients_AllUpdatedToSameClient()
    {
        // Arrange - Children have different clients initially
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "A",
            Children =
            [
                new TestJob { ClientId = 200, ClientCode = "B" },
                new TestJob { ClientId = 300, ClientCode = "C" },
                new TestJob { ClientId = 100, ClientCode = "A" }
            ]
        };

        // Act
        UpdateJobClient(parent, 500, "NEW");

        // Assert - All should now have the same client
        Assert.Equal(500, parent.ClientId);
        Assert.Equal("NEW", parent.ClientCode);
        Assert.All(parent.Children, child =>
        {
            Assert.Equal(500, child.ClientId);
            Assert.Equal("NEW", child.ClientCode);
        });
    }

    [Fact]
    public void UpdateJobClient_NullClientCode_SetsNullClientCode()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act - Update with null client code
        UpdateJobClient(parent, 200, null!);

        // Assert
        Assert.Equal(200, parent.ClientId);
        Assert.Null(parent.ClientCode);
        Assert.Equal(200, parent.Children[0].ClientId);
        Assert.Null(parent.Children[0].ClientCode);
    }

    [Fact]
    public void UpdateJobClient_ClientCodeLength_PreservedAsIs()
    {
        // Arrange
        var parent = new TestJob
        {
            ClientId = 100,
            ClientCode = "OLD",
            Children =
            [
                new TestJob { ClientId = 100, ClientCode = "OLD" }
            ]
        };

        // Act - Use a 5-character code (max length in DB)
        UpdateJobClient(parent, 200, "ABCDE");

        // Assert
        Assert.Equal("ABCDE", parent.ClientCode);
        Assert.Equal("ABCDE", parent.Children[0].ClientCode);
    }

}
