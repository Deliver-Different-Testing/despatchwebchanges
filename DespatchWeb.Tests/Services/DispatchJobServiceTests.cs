using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Services;
using FluentAssertions;
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

    #region DispatchJobsToCourierAsync Validation Tests

    [Fact]
    public async Task DispatchJobsToCourierAsync_NullJobIds_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(null!, 1);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
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
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("*Job list cannot be empty*");
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
        await act.Should().ThrowAsync<ArgumentOutOfRangeException>();
    }

    #endregion

    #region DispatchJobsToCourierAsync Workflow Tests

    [Fact]
    public async Task DispatchJobsToCourierAsync_SingleJob_AssignsCourierToJob()
    {
        // Arrange
        var service = CreateService();
        var jobIds = new List<int> { 1 };
        var courierId = 100;

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<List<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<List<int>>(), InternalJobStatus.AwaitingPod))
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

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<List<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<List<int>>(), InternalJobStatus.AwaitingPod))
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

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<List<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<List<int>>(), InternalJobStatus.AwaitingPod))
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

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<List<int>>(), courierId))
            .Returns(Task.CompletedTask);
        _courierRepositoryMock.Setup(x => x.ResetClearListAreaOrderAsync(courierId))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AssignCourierToChildJobsAsync(It.IsAny<List<int>>(), InternalJobStatus.AwaitingPod))
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

        _jobRepositoryMock.Setup(x => x.AssignCourierToJobAsync(It.IsAny<List<int>>(), courierId))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        // Act
        var act = async () => await service.DispatchJobsToCourierAsync(jobIds, courierId);

        // Assert
        await act.Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("Database error");
    }

    #endregion
}
