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

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>(Act);
        return;

        // Act
        async Task Act() => await service.DispatchJobsToCourierAsync(null!, 1);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_EmptyJobIds_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();
        var emptyList = new List<int>();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Contains("Job list cannot be empty", ex.Message);
        return;

        // Act
        async Task Act() => await service.DispatchJobsToCourierAsync(emptyList, 1);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_ZeroCourierId_ThrowsArgumentOutOfRangeException()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };

        // Assert
        await Assert.ThrowsAsync<ArgumentOutOfRangeException>(Act);
        return;

        // Act
        async Task Act() => await service.DispatchJobsToCourierAsync(jobIds, 0);
    }

    [Fact]
    public async Task DispatchJobsToCourierAsync_SingleJob_AssignsCourierToJob()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };
        const int courierId = 100;

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
        const int courierId = 100;

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
        const int courierId = 100;

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
        const int courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<IReadOnlyList<int>>(), courierId))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(Act);
        Assert.Equal("Database error", ex.Message);
        return;

        // Act
        async Task Act() => await service.DispatchJobsToCourierAsync(jobIds, courierId);
    }
}
