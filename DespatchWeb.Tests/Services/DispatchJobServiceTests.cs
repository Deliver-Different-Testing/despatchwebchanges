using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for DispatchJobService - tests job dispatch validation and workflow.
/// </summary>
public class DispatchJobServiceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();

    private DispatchJobService CreateService() => new(
        _jobRepositoryMock.Object,
        _courierRepositoryMock.Object
    );

    [Fact]
    public async Task DispatchJobsToCourierAsync_NullJobIds_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(null!, 1);

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>(act);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_EmptyJobIds_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();
        var emptyList = new List<int>();

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(emptyList, 1);

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(act);
        Assert.Contains("Job list cannot be empty", ex.Message);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_ZeroCourierId_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(jobIds, 0);

        // Assert
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(act);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_SingleJob_AssignsCourierToJob()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<IReadOnlyList<int>>(), InternalJobStatus.AwaitingPod))
            .Returns(Task.CompletedTask);

        // Act
        await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        _jobRepositoryMock.Verify(x => x.AssignCourierToJobAsync(
            It.Is<List<int>>(ids => ids.Contains(1)), courierId), Times.Once);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_MultipleJobs_AssignsAllJobs()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1, 2, 3 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<IReadOnlyList<int>>(), InternalJobStatus.AwaitingPod))
            .Returns(Task.CompletedTask);

        // Act
        await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        _jobRepositoryMock.Verify(x => x.AssignCourierToJobAsync(
            It.Is<List<int>>(ids => ids.Count == 3), courierId), Times.Once);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_ResetsClearListAreaOrder()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<IReadOnlyList<int>>(), InternalJobStatus.AwaitingPod))
            .Returns(Task.CompletedTask);

        // Act
        await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        _courierRepositoryMock.Verify(x => x.ResetClearListAreaOrderAsync(courierId), Times.Once);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_DispatchesChildJobs()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1, 2 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<IReadOnlyList<int>>(), InternalJobStatus.AwaitingPod))
            .Returns(Task.CompletedTask);

        // Act
        await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        _jobRepositoryMock.Verify(x => x.AssignCourierToChildJobsAsync(
            It.Is<List<int>>(ids => ids.Count == 2), InternalJobStatus.AwaitingPod), Times.Once);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(act);
        Assert.Equal("Database error", ex.Message);
    }

}
