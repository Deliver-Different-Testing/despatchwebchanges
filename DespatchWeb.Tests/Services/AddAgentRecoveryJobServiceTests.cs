using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddAgentRecoveryJobService - tests recovery agent job creation.
/// </summary>
public class AddAgentRecoveryJobServiceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<INationwideJobRepository> _nationwideJobRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();

    private AddAgentRecoveryJobService CreateService() => new(
        _jobRepositoryMock.Object,
        _nationwideJobRepositoryMock.Object,
        _tenantInfoServiceMock.Object
    );

    #region AddRecoveryAgentJobAsync Validation Tests

    [Fact]
    public async Task AddRecoveryAgentJobAsync_NullRequest_ThrowsException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = async () => await service.AddRecoveryAgentJobAsync(null!);

        // Assert
        // Service throws NullReferenceException because catch block accesses request.JobId for logging
        await act.Should().ThrowAsync<NullReferenceException>();
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync((TucJob)null!);

        // Act
        var act = async () => await service.AddRecoveryAgentJobAsync(request);

        // Assert
        await act.Should().ThrowAsync<ArgumentNullException>();
    }

    #endregion

    #region AddRecoveryAgentJobAsync Workflow Tests

    [Fact]
    public async Task AddRecoveryAgentJobAsync_ValidRequest_CreatesNewJob()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        const int newJobId = 999;

        SetupSuccessfulMocks(request, parentJob, newJobId);

        // Act
        var result = await service.AddRecoveryAgentJobAsync(request);

        // Assert
        result.Should().Be(newJobId);
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbNumber == "JOB001R1" &&
            j.ParentId == parentJob.UcjbId &&
            j.JobRelationshipTypeId == (int)JobRelationshipTypes.SplitChild)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_WithExistingParentId_UsesExistingParentId()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.ParentId = 500; // Parent already has a parent

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.ParentId == 500)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_CreatesNote()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucNote>(n =>
            n.JobId == parentJob.UcjbId &&
            n.NoteText.Contains("Recovery agent") &&
            n.NoteTypeId == (int)NoteType.AgentUpdate)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_CreatesJobRecoveryAgent()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        var newJobId = 999;

        SetupSuccessfulMocks(request, parentJob, newJobId);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<JobRecoveryAgent>(r =>
            r.AgentId == request.AgentId &&
            r.AirportId == request.AirportId &&
            r.IsPrimary == request.IsPrimaryRecoveryAgent)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_SavesChangesAfterJobCreation()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.SaveChangesAsync(), Times.Exactly(2));
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_CopiesJobPropertiesFromParent()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbClientId = 42;
        parentJob.UcjbWeight = 10.5;
        parentJob.UcjbSpeed = 1;
        parentJob.UcjbType = 2;

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbClientId == parentJob.UcjbClientId &&
            j.UcjbWeight == parentJob.UcjbWeight &&
            j.UcjbSpeed == parentJob.UcjbSpeed &&
            j.UcjbType == parentJob.UcjbType)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_SetsAttentionFlagToTrue()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbAttention == true)), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_SetsJobReferenceToParentNumber()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "PARENT123";

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbOurRef == "PARENT123")), Times.Once);
    }

    #endregion

    #region Job Number Generation Tests

    [Fact]
    public async Task AddRecoveryAgentJobAsync_FirstRecoveryJob_AppendsR1()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "JOB001";

        SetupSuccessfulMocks(request, parentJob, 999);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbNumber == "JOB001R1")), Times.Once);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_R1Exists_AppendsR2()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "JOB001";

        SetupSuccessfulMocks(request, parentJob, 999);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync("JOB001R1"))
            .ReturnsAsync(true);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync("JOB001R2"))
            .ReturnsAsync(false);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        _jobRepositoryMock.Verify(x => x.AddEntityAsync(It.Is<TucJob>(j =>
            j.UcjbNumber == "JOB001R2")), Times.Once);
    }

    #endregion

    #region Helper Methods

    private static AddAgentRecoveryRequest CreateValidRequest() => new()
    {
        JobId = 1,
        AgentId = 100,
        AirportId = 50,
        IsPrimaryRecoveryAgent = true
    };

    private static TucJob CreateParentJob() => new()
    {
        UcjbId = 1,
        UcjbNumber = "JOB001",
        UcjbDate = DateTime.Today,
        UcjbTime = DateTime.Today.AddHours(10),
        UcjbClientId = 1,
        UcjbStatus = 1,
        UcjbFrom = 100,
        UcjbFromAddr = "123 Origin St",
        UcjbTo = 200,
        UcjbToAddr = "456 Dest Ave"
    };

    private void SetupSuccessfulMocks(AddAgentRecoveryRequest request, TucJob parentJob, int newJobId)
    {
        _jobRepositoryMock.Setup(x => x.GetByIdAsync<TucJob>(request.JobId))
            .ReturnsAsync(parentJob);
        _jobRepositoryMock.Setup(x => x.JobNumberExistsAsync(It.IsAny<string>()))
            .ReturnsAsync(false);
        _nationwideJobRepositoryMock.Setup(x => x.GetAgentNameAsync(request.AgentId))
            .ReturnsAsync("Test Agent");
        _tenantInfoServiceMock.Setup(x => x.GetStaffId())
            .Returns(1);
        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        // Capture the job when added and set its ID
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<TucJob>()))
            .Callback<TucJob>(j => j.UcjbId = newJobId)
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<TucNote>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.AddEntityAsync(It.IsAny<JobRecoveryAgent>()))
            .Returns(Task.CompletedTask);
        _jobRepositoryMock.Setup(x => x.SaveChangesAsync())
            .Returns(Task.CompletedTask);
    }

    #endregion
}
