using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using MockQueryable.Moq;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.PodSearchDownloadAsync method.
/// Tests the refactored query that now uses direct mappings and queries both live and archived tables.
/// </summary>
public class JobRepositoryPodSearchDownloadTests
{
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();

    private void SetupContextMocks(List<TucJob> liveJobs,
        List<TucJobArchive> archivedJobs)
    {
        // Create mock DbSets using MockQueryable
        var liveJobsMock = liveJobs.AsQueryable().BuildMockDbSet();
        var archivedJobsMock = archivedJobs.AsQueryable().BuildMockDbSet();

        // Create two separate mock contexts (the repository uses separate contexts for parallel queries)
        var liveContextMock = new Mock<DespatchContext>(new DbContextOptions<DespatchContext>());
        var archivedContextMock = new Mock<DespatchContext>(new DbContextOptions<DespatchContext>());

        liveContextMock.Setup(c => c.TucJobs).Returns(liveJobsMock.Object);
        archivedContextMock.Setup(c => c.TucJobArchives).Returns(archivedJobsMock.Object);

        // Setup factory to return contexts in sequence
        var callCount = 0;
        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() =>
            {
                callCount++;
                return callCount == 1 ? liveContextMock.Object : archivedContextMock.Object;
            });
    }

    [Fact]
    public async Task PodSearchDownloadAsync_ReturnsLiveAndArchivedJobs()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "LIVE-001", new DateTime(2024, 1, 15)),
            CreateLiveJob(2, "LIVE-002", new DateTime(2024, 1, 16))
        };

        var archivedJobs = new List<TucJobArchive>
        {
            CreateArchivedJob(101, "ARCH-001", new DateTime(2024, 1, 15)),
            CreateArchivedJob(102, "ARCH-002", new DateTime(2024, 1, 16))
        };

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(4);
        result.Should().Contain(j => j.JobNumber == "LIVE-001");
        result.Should().Contain(j => j.JobNumber == "LIVE-002");
        result.Should().Contain(j => j.JobNumber == "ARCH-001");
        result.Should().Contain(j => j.JobNumber == "ARCH-002");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_DateFilter_FiltersCorrectly()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "JOB-JAN", new DateTime(2024, 1, 15)),
            CreateLiveJob(2, "JOB-FEB", new DateTime(2024, 2, 15)), // Outside range
            CreateLiveJob(3, "JOB-JAN2", new DateTime(2024, 1, 20))
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - Only January jobs
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-JAN");
        result.Should().Contain(j => j.JobNumber == "JOB-JAN2");
        result.Should().NotContain(j => j.JobNumber == "JOB-FEB");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_ClientFilter_FiltersCorrectly()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "CLIENT1-JOB", new DateTime(2024, 1, 15), clientId: 100),
            CreateLiveJob(2, "CLIENT2-JOB", new DateTime(2024, 1, 15), clientId: 200),
            CreateLiveJob(3, "CLIENT1-JOB2", new DateTime(2024, 1, 15), clientId: 100)
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - Only client 100
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: [100]
        );

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.JobNumber.StartsWith("CLIENT1"));
    }

    [Fact]
    public async Task PodSearchDownloadAsync_CourierFilter_FiltersCorrectly()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "COURIER1-JOB", new DateTime(2024, 1, 15), courierId: 10),
            CreateLiveJob(2, "COURIER2-JOB", new DateTime(2024, 1, 15), courierId: 20),
            CreateLiveJob(3, "COURIER1-JOB2", new DateTime(2024, 1, 15), courierId: 10)
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - Only courier 10
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [10],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.JobNumber.StartsWith("COURIER1"));
    }

    [Fact]
    public async Task PodSearchDownloadAsync_SpeedFilter_FiltersCorrectly()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "SPEED1-JOB", new DateTime(2024, 1, 15), speedId: 1),
            CreateLiveJob(2, "SPEED2-JOB", new DateTime(2024, 1, 15), speedId: 2),
            CreateLiveJob(3, "SPEED1-JOB2", new DateTime(2024, 1, 15), speedId: 1)
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - Only speed 1
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [1],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.JobNumber.StartsWith("SPEED1"));
    }

    [Fact(Skip = "EF.Functions.Like cannot be mocked in-memory - requires integration test")]
    public async Task PodSearchDownloadAsync_JobNumberSearch_FiltersCorrectly()
    {
        // Note: This test requires EF.Functions.Like which only works with a real database.
        // The repository uses EF.Functions.Like for job number search which can't be evaluated client-side.
        // This test should be run as an integration test with a real database connection.

        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "ABC-001", new DateTime(2024, 1, 15)),
            CreateLiveJob(2, "ABC-002", new DateTime(2024, 1, 15)),
            CreateLiveJob(3, "XYZ-001", new DateTime(2024, 1, 15))
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - Search for "ABC"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: "ABC",
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(2);
        result.Should().OnlyContain(j => j.JobNumber.Contains("ABC"));
    }

    [Fact]
    public async Task PodSearchDownloadAsync_ParentChildFilter_ExcludesParentsWithChildren()
    {
        // Arrange - Parent job 1 has child job 2
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "PARENT-001", new DateTime(2024, 1, 15), parentId: 1), // Parent (self-reference)
            CreateLiveJob(2, "CHILD-001", new DateTime(2024, 1, 15), parentId: 1),  // Child of 1
            CreateLiveJob(3, "SINGLE-001", new DateTime(2024, 1, 15))                // No parent/child relationship
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert - Parent should be excluded because it has a child in results
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "CHILD-001");
        result.Should().Contain(j => j.JobNumber == "SINGLE-001");
        result.Should().NotContain(j => j.JobNumber == "PARENT-001");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_ResultsSortedByJobNumber()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "C-JOB", new DateTime(2024, 1, 15)),
            CreateLiveJob(2, "A-JOB", new DateTime(2024, 1, 15)),
            CreateLiveJob(3, "B-JOB", new DateTime(2024, 1, 15))
        };

        var archivedJobs = new List<TucJobArchive>();

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().BeInAscendingOrder(j => j.JobNumber);
    }

    [Fact]
    public async Task PodSearchDownloadAsync_IsArchivedFlag_SetCorrectly()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "LIVE-001", new DateTime(2024, 1, 15))
        };

        var archivedJobs = new List<TucJobArchive>
        {
            CreateArchivedJob(101, "ARCH-001", new DateTime(2024, 1, 15))
        };

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        var liveResult = result.Single(j => j.JobNumber == "LIVE-001");
        var archivedResult = result.Single(j => j.JobNumber == "ARCH-001");

        liveResult.IsArchived.Should().BeFalse();
        archivedResult.IsArchived.Should().BeTrue();
    }

    [Fact]
    public async Task PodSearchDownloadAsync_EmptyFilters_ReturnsAllJobsInDateRange()
    {
        // Arrange
        var liveJobs = new List<TucJob>
        {
            CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15))
        };

        var archivedJobs = new List<TucJobArchive>
        {
            CreateArchivedJob(101, "JOB-002", new DateTime(2024, 1, 15))
        };

        SetupContextMocks(liveJobs, archivedJobs);

        var repository = CreateRepository();

        // Act - No filters except date
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: null,
            clientIds: []
        );

        // Assert
        result.Should().HaveCount(2);
    }

    #region Helper Methods

    private JobRepository CreateRepository()
    {
        return new JobRepository(
            _contextFactoryMock.Object,
            _tenantInfoServiceMock.Object,
            _clearListEnvelopeServiceMock.Object
        );
    }

    private static TucJob CreateLiveJob(
        int id,
        string jobNumber,
        DateTime date,
        int? clientId = null,
        int? courierId = null,
        int? speedId = null,
        int? parentId = null)
    {
        return new TucJob
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = date,
            UcjbTime = date.AddHours(9),
            UcjbClientId = clientId,
            UcjbCourierId = courierId,
            UcjbSpeed = speedId,
            ParentId = parentId,
            UcjbAmount = 100m,
            FuelSurchargeAmount = 10m,
            PpdexclusiveAmount = 5m,
            PricingBreakdownJobs = new List<PricingBreakdown>(),
            TucJobNationwides = new List<TucJobNationwide>()
        };
    }

    private static TucJobArchive CreateArchivedJob(
        int id,
        string jobNumber,
        DateTime date,
        int? clientId = null,
        int? courierId = null,
        int? speedId = null,
        int? parentId = null)
    {
        return new TucJobArchive
        {
            UcjbId = id,
            UcjbNumber = jobNumber,
            UcjbDate = date,
            UcjbTime = date.AddHours(9),
            UcjbClientId = clientId,
            UcjbCourierId = courierId,
            UcjbSpeed = speedId,
            ParentId = parentId,
            UcjbAmount = 100m,
            FuelSurchargeAmount = 10m,
            PpdexclusiveAmount = 5m,
            PricingBreakdowns = new List<PricingBreakdownArchive>()
        };
    }

    #endregion
}
