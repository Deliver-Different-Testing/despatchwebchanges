using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using NSubstitute;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for AddAgentRecoveryJobService - tests recovery agent job creation.
/// </summary>
public class AddAgentRecoveryJobServiceTests
{
    private readonly IJobQueryRepository _jobQueryRepositoryMock = Substitute.For<IJobQueryRepository>();
    private readonly IJobCommandRepository _jobCommandRepositoryMock = Substitute.For<IJobCommandRepository>();
    private readonly INationwideJobRepository _nationwideJobRepositoryMock = Substitute.For<INationwideJobRepository>();
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    // The leg created by CreateMinimalTucJobAsync, then mutated in place by the service.
    private TucJob? _createdLeg;

    private AddAgentRecoveryJobService CreateService() => new(
        _jobQueryRepositoryMock,
        _jobCommandRepositoryMock,
        _nationwideJobRepositoryMock,
        _tenantInfoServiceMock,
        _clock
    );

    [Fact]
    public async Task AddRecoveryAgentJobAsync_NullRequest_ThrowsException()
    {
        // Arrange
        var service = CreateService();

        // Assert
        // Service throws NullReferenceException because catch block accesses request.JobId for logging
        await Assert.ThrowsAsync<NullReferenceException>((Func<Task<int>>?)Act ??
                                                         throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddRecoveryAgentJobAsync(null!);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_JobNotFound_ThrowsArgumentNullException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns((TucJob)null!);

        // Assert
        await Assert.ThrowsAsync<ArgumentNullException>((Func<Task<int>>?)Act ?? throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddRecoveryAgentJobAsync(request);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_CreateJobFails_ThrowsInvalidOperationException()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();

        SetupSuccessfulMocks(request, parentJob, 999);
        _jobCommandRepositoryMock.CreateMinimalTucJobAsync(
                Arg.Any<CreateMinimalTucJobInputModel>(), Arg.Any<CancellationToken>())
            .Returns(new CreateMinimalTucJobResponse { Success = false, Message = "SP error" });

        // Assert
        await Assert.ThrowsAsync<InvalidOperationException>((Func<Task<int>>?)Act ??
                                                            throw new InvalidOperationException());
        return;

        // Act
        async Task<int> Act() => await service.AddRecoveryAgentJobAsync(request);
    }

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

        // Assert - the leg is booked through the maintained create-job path...
        Assert.Equal(newJobId, result);
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001R1"),
            Arg.Any<CancellationToken>());

        // ...then patched into a hidden SplitChild leg.
        Assert.NotNull(_createdLeg);
        Assert.Equal(parentJob.UcjbId, _createdLeg.ParentId);
        Assert.Equal((int)JobRelationshipTypes.SplitChild, _createdLeg.JobRelationshipTypeId);
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
        Assert.NotNull(_createdLeg);
        Assert.Equal(500, _createdLeg.ParentId);
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
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<TucNote>(n =>
            n.JobId == parentJob.UcjbId &&
            n.NoteText.Contains("Recovery agent") &&
            n.NoteTypeId == (int)NoteType.AgentUpdate));
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_CreatesJobRecoveryAgent()
    {
        // Arrange
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        const int newJobId = 999;

        SetupSuccessfulMocks(request, parentJob, newJobId);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().AddEntityAsync(Arg.Is<JobRecoveryAgent>(r =>
            r.JobId == newJobId &&
            r.AgentId == request.AgentId &&
            r.AirportId == request.AirportId &&
            r.IsPrimary == request.IsPrimaryRecoveryAgent));
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

        // Assert - one save after applying the leg fields, one after the note/agent records.
        await _jobCommandRepositoryMock.Received(2).SaveChangesAsync();
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
        Assert.NotNull(_createdLeg);
        Assert.Equal(parentJob.UcjbClientId, _createdLeg.UcjbClientId);
        Assert.Equal(parentJob.UcjbWeight, _createdLeg.UcjbWeight);
        Assert.Equal(parentJob.UcjbSpeed, _createdLeg.UcjbSpeed);
        Assert.Equal(parentJob.UcjbType, _createdLeg.UcjbType);
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
        Assert.NotNull(_createdLeg);
        Assert.True(_createdLeg.UcjbAttention);
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
        Assert.NotNull(_createdLeg);
        Assert.Equal("PARENT123", _createdLeg.UcjbOurRef);
    }

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
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001R1"),
            Arg.Any<CancellationToken>());
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
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001R1")
            .Returns(true);
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001R2")
            .Returns(false);

        // Act
        await service.AddRecoveryAgentJobAsync(request);

        // Assert
        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001R2"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_NewLeg_DoesNotDuplicateParentCharge()
    {
        // Regression guard for the reported "split charges the client x2 / x3" bug.
        //
        // The recovery leg is an internal, non-dispatched sub-record (DisplayInDespatch = false,
        // RatedManually = true) — the client charge stays on the parent job. Previously the leg
        // copied job.UcjbAmount, so both the untouched parent (relType null -> billed) and the new
        // SplitChild leg (DisplayStatement -> billed) appeared on the client statement at the full
        // amount: one agent => 2x, a second agent => 3x.
        //
        // The leg must now carry no charge so the family grand-total equals the original job amount.
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbAmount = 100m;

        SetupSuccessfulMocks(request, parentJob, 999);

        await service.AddRecoveryAgentJobAsync(request);

        Assert.NotNull(_createdLeg);

        // The leg is still a SplitChild, but it carries no client charge...
        Assert.Equal((int)JobRelationshipTypes.SplitChild, _createdLeg.JobRelationshipTypeId);
        Assert.Equal(0m, _createdLeg.UcjbAmount);

        // ...and the parent keeps the original charge.
        Assert.Equal(100m, parentJob.UcjbAmount);

        // Invariant: parent + legs equals the original total — no double-charging.
        var grandTotal = (parentJob.UcjbAmount ?? 0m) + (_createdLeg.UcjbAmount ?? 0m);
        Assert.Equal(100m, grandTotal);
    }

    [Fact]
    public async Task AddRecoveryAgentJobAsync_SecondAgent_StillNoDuplicateCharge()
    {
        // A second recovery agent was the x3 case. Each added leg must stay at zero charge so the
        // family total never drifts above the original regardless of how many agents are added.
        var service = CreateService();
        var request = CreateValidRequest();
        var parentJob = CreateParentJob();
        parentJob.UcjbNumber = "JOB001";
        parentJob.UcjbAmount = 100m;

        SetupSuccessfulMocks(request, parentJob, 1000);
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001R1").Returns(true); // first agent already added
        _jobQueryRepositoryMock.JobNumberExistsAsync("JOB001R2").Returns(false);

        await service.AddRecoveryAgentJobAsync(request);

        await _jobCommandRepositoryMock.Received().CreateMinimalTucJobAsync(
            Arg.Is<CreateMinimalTucJobInputModel>(m => m.JobNumber == "JOB001R2"),
            Arg.Any<CancellationToken>());
        Assert.NotNull(_createdLeg);
        Assert.Equal(0m, _createdLeg.UcjbAmount);
    }

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
        UcjbDate = TestDates.Today,
        UcjbTime = TestDates.Today.AddHours(10),
        UcjbClientId = 1,
        UcjbContact = "Booker",
        UcjbSpeed = 1,
        UcjbStatus = 1,
        UcjbFrom = 100,
        UcjbFromAddr = "123 Origin St",
        UcjbTo = 200,
        UcjbToAddr = "456 Dest Ave"
    };

    private void SetupSuccessfulMocks(AddAgentRecoveryRequest request, TucJob parentJob, int newJobId)
    {
        _createdLeg = new TucJob { UcjbId = newJobId };

        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(request.JobId)
            .Returns(parentJob);
        _jobQueryRepositoryMock.JobNumberExistsAsync(Arg.Any<string>())
            .Returns(false);
        _nationwideJobRepositoryMock.GetAgentNameAsync(request.AgentId)
            .Returns("Test Agent");
        _tenantInfoServiceMock.GetStaffId()
            .Returns(1);
        _tenantInfoServiceMock.GetContactId()
            .Returns(1);

        // The leg is created via the maintained create-job path, then reloaded for the field update.
        _jobCommandRepositoryMock.CreateMinimalTucJobAsync(
                Arg.Any<CreateMinimalTucJobInputModel>(), Arg.Any<CancellationToken>())
            .Returns(new CreateMinimalTucJobResponse { Success = true, JobId = newJobId });
        _jobQueryRepositoryMock.GetByIdAsync<TucJob>(newJobId)
            .Returns(_createdLeg);

        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<TucNote>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.AddEntityAsync(Arg.Any<JobRecoveryAgent>())
            .Returns(Task.CompletedTask);
        _jobCommandRepositoryMock.SaveChangesAsync()
            .Returns(Task.CompletedTask);
    }
}
