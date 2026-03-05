using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for JobRepository.PodSearchDownloadAsync method.
/// Tests the refactored query that now uses direct mappings and queries both live and archived tables.
/// Uses SQLite in-memory database with shared connection for parallel context queries.
/// </summary>
public class JobRepositoryPodSearchDownloadTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly Mock<ICreateJobService> _createJobServiceMock = new();

    public JobRepositoryPodSearchDownloadTests()
    {
        // Use a shared connection so multiple contexts can access the same in-memory database
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _connection.CreateFunction("getdate", () => DateTime.Now);

        // Disable foreign keys for simpler test setup
        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        // Create the schema
        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        // Setup factory to return new contexts that share the same connection
        _contextFactoryMock.Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        _contextFactoryMock.Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));

        // Default tenant setup
        _tenantInfoServiceMock.Setup(x => x.GetTenantTimeZone()).Returns("New Zealand Standard Time");
        _tenantInfoServiceMock.Setup(x => x.IsUsTenant()).Returns(false);
    }

    public void Dispose()
    {
        _connection.Dispose();
    }

    private JobRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object,
        _createJobServiceMock.Object
    );

    private DespatchContext CreateContext() => new(_contextOptions);

    [Fact]
    public async Task PodSearchDownloadAsync_ReturnsLiveAndArchivedJobs()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "LIVE-001", new DateTime(2024, 1, 15)),
                CreateLiveJob(2, "LIVE-002", new DateTime(2024, 1, 16))
            );
            context.TucJobArchives.AddRange(
                CreateArchivedJob(101, "ARCH-001", new DateTime(2024, 1, 15)),
                CreateArchivedJob(102, "ARCH-002", new DateTime(2024, 1, 16))
            );
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-JAN", new DateTime(2024, 1, 15)),
                CreateLiveJob(2, "JOB-FEB", new DateTime(2024, 2, 15)), // Outside range
                CreateLiveJob(3, "JOB-JAN2", new DateTime(2024, 1, 20))
            );
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "CLIENT1-JOB", new DateTime(2024, 1, 15), clientId: 100),
                CreateLiveJob(2, "CLIENT2-JOB", new DateTime(2024, 1, 15), clientId: 200),
                CreateLiveJob(3, "CLIENT1-JOB2", new DateTime(2024, 1, 15), clientId: 100)
            );
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "COURIER1-JOB", new DateTime(2024, 1, 15), courierId: 10),
                CreateLiveJob(2, "COURIER2-JOB", new DateTime(2024, 1, 15), courierId: 20),
                CreateLiveJob(3, "COURIER1-JOB2", new DateTime(2024, 1, 15), courierId: 10)
            );
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "SPEED1-JOB", new DateTime(2024, 1, 15), speedId: 1),
                CreateLiveJob(2, "SPEED2-JOB", new DateTime(2024, 1, 15), speedId: 2),
                CreateLiveJob(3, "SPEED1-JOB2", new DateTime(2024, 1, 15), speedId: 1)
            );
            await context.SaveChangesAsync();
        }

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

    [Fact]
    public async Task PodSearchDownloadAsync_JobNumberSearch_FiltersCorrectly()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "ABC-001", new DateTime(2024, 1, 15)),
                CreateLiveJob(2, "ABC-002", new DateTime(2024, 1, 15)),
                CreateLiveJob(3, "XYZ-001", new DateTime(2024, 1, 15))
            );
            await context.SaveChangesAsync();
        }

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
    public async Task PodSearchDownloadAsync_ParentChildJobs_ReturnsAllJobsToMatchSearchBehavior()
    {
        // Arrange - Parent job 1 has child job 2
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "PARENT-001", new DateTime(2024, 1, 15), parentId: 1), // Parent (self-reference)
                CreateLiveJob(2, "CHILD-001", new DateTime(2024, 1, 15), parentId: 1),  // Child of 1
                CreateLiveJob(3, "SINGLE-001", new DateTime(2024, 1, 15))                // No parent/child relationship
            );
            await context.SaveChangesAsync();
        }

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

        // Assert - All jobs should be included (parents and children) to match search behavior
        result.Should().HaveCount(3);
        result.Should().Contain(j => j.JobNumber == "PARENT-001");
        result.Should().Contain(j => j.JobNumber == "CHILD-001");
        result.Should().Contain(j => j.JobNumber == "SINGLE-001");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_ResultsSortedByJobNumber()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "C-JOB", new DateTime(2024, 1, 15)),
                CreateLiveJob(2, "A-JOB", new DateTime(2024, 1, 15)),
                CreateLiveJob(3, "B-JOB", new DateTime(2024, 1, 15))
            );
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "LIVE-001", new DateTime(2024, 1, 15)));
            context.TucJobArchives.Add(CreateArchivedJob(101, "ARCH-001", new DateTime(2024, 1, 15)));
            await context.SaveChangesAsync();
        }

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
        await using (var context = CreateContext())
        {
            context.TucJobs.Add(CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15)));
            context.TucJobArchives.Add(CreateArchivedJob(101, "JOB-002", new DateTime(2024, 1, 15)));
            await context.SaveChangesAsync();
        }

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

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesPodName()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), podName: "John Smith"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), podName: "Jane Doe"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), podName: "Bob Johnson")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "John"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "John",
            clientIds: []
        );

        // Assert - Should find "John Smith" and "Bob Johnson"
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-003");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesContactPhone()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), contactPhone: "0412345678"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), contactPhone: "0498765432"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), contactPhone: "0412999888")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "0412"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "0412",
            clientIds: []
        );

        // Assert - Should find jobs with phone starting with 0412
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-003");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesPickupFromPhone()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-AAA", new DateTime(2024, 1, 15), pickupFromPhone: "0312345678"),
                CreateLiveJob(2, "JOB-BBB", new DateTime(2024, 1, 15), pickupFromPhone: "0398765432"),
                CreateLiveJob(3, "JOB-CCC", new DateTime(2024, 1, 15), pickupFromPhone: "0212345678")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "031" (more specific to avoid matching other fields)
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "031",
            clientIds: []
        );

        // Assert - Should find job with pickup phone starting with 031
        result.Should().HaveCount(1);
        result.Should().Contain(j => j.JobNumber == "JOB-AAA");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesDeliverToPhone()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), deliverToPhone: "0712345678"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), deliverToPhone: "0798765432"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), deliverToPhone: "0812345678")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "07"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "07",
            clientIds: []
        );

        // Assert - Should find jobs with delivery phone starting with 07
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-002");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesProofOfDeliveryEmail()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), podEmail: "john@example.com"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), podEmail: "jane@other.com"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), podEmail: "bob@example.com")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "example.com"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "example.com",
            clientIds: []
        );

        // Assert - Should find jobs with POD email at example.com
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-003");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesProofOfDeliveryMobile()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), podMobile: "0400111222"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), podMobile: "0400333444"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), podMobile: "0411555666")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "0400"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "0400",
            clientIds: []
        );

        // Assert - Should find jobs with POD mobile starting with 0400
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-002");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesTrackingEmail()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), trackingEmail: "tracking@company.com"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), trackingEmail: "notify@company.com"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), trackingEmail: "tracking@other.com")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "company.com"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "company.com",
            clientIds: []
        );

        // Assert - Should find jobs with tracking email at company.com
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-002");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesTrackingMobile()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CreateLiveJob(1, "JOB-001", new DateTime(2024, 1, 15), trackingMobile: "0422111222"),
                CreateLiveJob(2, "JOB-002", new DateTime(2024, 1, 15), trackingMobile: "0422333444"),
                CreateLiveJob(3, "JOB-003", new DateTime(2024, 1, 15), trackingMobile: "0433555666")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "0422"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "0422",
            clientIds: []
        );

        // Assert - Should find jobs with tracking mobile starting with 0422
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "JOB-001");
        result.Should().Contain(j => j.JobNumber == "JOB-002");
    }

    [Fact]
    public async Task PodSearchDownloadAsync_WildcardSearch_SearchesArchivedJobFields()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            context.TucJobArchives.AddRange(
                CreateArchivedJob(1, "ARCH-001", new DateTime(2024, 1, 15), podName: "John Smith", contactPhone: "0412345678"),
                CreateArchivedJob(2, "ARCH-002", new DateTime(2024, 1, 15), podName: "Jane Doe", contactPhone: "0498765432"),
                CreateArchivedJob(3, "ARCH-003", new DateTime(2024, 1, 15), podName: "Bob Johnson", contactPhone: "0412999888")
            );
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act - Search for "John"
        var result = await repository.PodSearchDownloadAsync(
            fromDate: new DateTime(2024, 1, 1),
            toDate: new DateTime(2024, 1, 31),
            courierIds: [],
            speedIds: [],
            job: null,
            wild: "John",
            clientIds: []
        );

        // Assert - Should find archived jobs with "John" in POD name
        result.Should().HaveCount(2);
        result.Should().Contain(j => j.JobNumber == "ARCH-001");
        result.Should().Contain(j => j.JobNumber == "ARCH-003");
    }

    #region Helper Methods

    private static TucJob CreateLiveJob(
        int id,
        string jobNumber,
        DateTime date,
        int? clientId = null,
        int? courierId = null,
        int? speedId = null,
        int? parentId = null,
        string? podName = null,
        string? contactPhone = null,
        string? pickupFromPhone = null,
        string? deliverToPhone = null,
        string? podEmail = null,
        string? podMobile = null,
        string? trackingEmail = null,
        string? trackingMobile = null)
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
            UcjbPodname = podName,
            UcjbContactPhone = contactPhone,
            PickupFromPhone = pickupFromPhone,
            DeliverToPhone = deliverToPhone,
            ProofOfDeliveryEmail = podEmail,
            ProofOfDeliveryMobile = podMobile,
            TrackingEmail = trackingEmail,
            TrackingMobile = trackingMobile
        };
    }

    private static TucJobArchive CreateArchivedJob(
        int id,
        string jobNumber,
        DateTime date,
        int? clientId = null,
        int? courierId = null,
        int? speedId = null,
        int? parentId = null,
        string? podName = null,
        string? contactPhone = null,
        string? pickupFromPhone = null,
        string? deliverToPhone = null,
        string? podEmail = null,
        string? podMobile = null,
        string? trackingEmail = null,
        string? trackingMobile = null)
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
            UcjbPodname = podName,
            UcjbContactPhone = contactPhone,
            PickUpFromPhone = pickupFromPhone,
            DeliverToPhone = deliverToPhone,
            ProofOfDeliveryEmail = podEmail,
            ProofOfDeliveryMobile = podMobile,
            TrackingEmail = trackingEmail,
            TrackingMobile = trackingMobile
        };
    }

    #endregion
}
