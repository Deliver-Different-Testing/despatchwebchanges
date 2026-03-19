using DespatchWeb.Enums;

namespace DespatchWeb.Tests.Enums;

/// <summary>
/// Tests for the JobStatus enum to ensure status values are correct and consistent.
/// </summary>
public class JobStatusTests
{
    [Fact]
    public void Missing_ShouldHaveValue1001()
    {
        // Arrange & Act
        const int missingValue = (int)JobStatus.Missing;

        // Assert
        Assert.Equal(1001, missingValue);
    }

    [Fact]
    public void Void_ShouldHaveValue1000()
    {
        // Arrange & Act
        const int voidValue = (int)JobStatus.Void;

        // Assert
        Assert.Equal(1000, voidValue);
    }

    [Fact]
    public void Missing_ShouldBeDistinctFromVoid()
    {
        // Assert
        Assert.NotEqual(JobStatus.Void, JobStatus.Missing);
        Assert.NotEqual((int)JobStatus.Void, (int)JobStatus.Missing);
    }

    [Fact]
    public void Missing_ShouldBeGreaterThanVoid()
    {
        // Assert - Missing (1001) should come after Void (1000) in the special status range
        Assert.True((int)JobStatus.Missing > (int)JobStatus.Void);
    }

    [Theory]
    [InlineData(JobStatus.New, 0)]
    [InlineData(JobStatus.Dispatched, 1)]
    [InlineData(JobStatus.Accepted, 2)]
    [InlineData(JobStatus.Rejected, 3)]
    [InlineData(JobStatus.LatePickup, 4)]
    [InlineData(JobStatus.PickedUp, 5)]
    [InlineData(JobStatus.Completed, 6)]
    [InlineData(JobStatus.Warning, 7)]
    [InlineData(JobStatus.LateDelivery, 8)]
    [InlineData(JobStatus.AwaitingPod, 9)]
    [InlineData(JobStatus.Undeliverable, 10)]
    [InlineData(JobStatus.InTransit, 11)]
    [InlineData(JobStatus.Acknowledge, 12)]
    [InlineData(JobStatus.AssumingCompleted, 13)]
    [InlineData(JobStatus.ReadyForPacking, 14)]
    [InlineData(JobStatus.ReadyToPickup, 15)]
    [InlineData(JobStatus.AwaitingProcessing, 16)]
    [InlineData(JobStatus.OutForDelivery, 17)]
    [InlineData(JobStatus.Preassigned, 18)]
    [InlineData(JobStatus.OutboundAgentAssigned, 103)]
    [InlineData(JobStatus.InboundAgentAssigned, 104)]
    [InlineData(JobStatus.GroundAgentAssigned, 105)]
    [InlineData(JobStatus.Void, 1000)]
    [InlineData(JobStatus.Missing, 1001)]
    public void AllJobStatuses_ShouldHaveExpectedValues(JobStatus status, int expectedValue) =>
        // Assert
        Assert.Equal(expectedValue, (int)status);

    [Fact]
    public void JobStatus_ShouldContainMissingStatus()
    {
        // Arrange
        var allStatuses = Enum.GetValues<JobStatus>();

        // Assert
        Assert.Contains(JobStatus.Missing, allStatuses);
    }

    [Fact]
    public void JobStatus_MissingShouldBeParseable()
    {
        // Arrange & Act
        var parsed = Enum.TryParse<JobStatus>("Missing", out var result);

        // Assert
        Assert.True(parsed);
        Assert.Equal(JobStatus.Missing, result);
    }

    [Fact]
    public void JobStatus_1001ShouldBeParseable()
    {
        // Arrange & Act
        var parsed = Enum.TryParse<JobStatus>("1001", out var result);

        // Assert
        Assert.True(parsed);
        Assert.Equal(JobStatus.Missing, result);
    }

    [Fact]
    public void JobStatus_MissingShouldHaveCorrectName()
    {
        // Arrange & Act
        const string name = nameof(JobStatus.Missing);

        // Assert
        Assert.Equal("Missing", name);
    }
}
