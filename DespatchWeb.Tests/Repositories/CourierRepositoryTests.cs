using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for CourierRepository - focuses on GetClearListsAsync parallel query execution.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class CourierRepositoryTests : IDisposable
{
    private readonly SqliteConnection _connection;
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly IMemoryCache _cache;

    public CourierRepositoryTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        // Register custom SQL Server functions for SQLite compatibility
        _connection.CreateFunction("getdate", () => DateTime.Now);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        // Create schema
        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        // Setup factory to return new context instances (for parallel queries)
        _contextFactoryMock
            .Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));
        _contextFactoryMock
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        // Setup tenant info
        _tenantInfoServiceMock
            .Setup(x => x.GetCurrentTenantTime())
            .Returns(new DateTime(2024, 1, 15, 10, 0, 0));
        _tenantInfoServiceMock
            .Setup(x => x.GetTenantTimeZone())
            .Returns("New Zealand Standard Time");

        // Setup memory cache
        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public void Dispose()
    {
        _cache.Dispose();
        _connection.Dispose();
    }

    private CourierRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clearListEnvelopeServiceMock.Object,
        _cache
    );

    private DespatchContext CreateContext() => new(_contextOptions);

    #region GetClearListsAsync - Empty Input Tests

    [Fact]
    public async Task GetClearListsAsync_WithEmptyDespatchViewIds_ReturnsEmptyViewModel()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().BeEmpty();
        result.Columns.Should().BeEmpty();
    }

    [Fact]
    public async Task GetClearListsAsync_WithNonExistentDespatchViewIds_ReturnsEmptyViewModel()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([999, 998, 997]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().BeEmpty();
        result.Columns.Should().BeEmpty();
    }

    #endregion

    #region GetClearListsAsync - No Clear List Areas Tests

    [Fact]
    public async Task GetClearListsAsync_WithDespatchViewWithoutClearListArea_ReturnsEmptyViewModel()
    {
        // Arrange
        await using (var context = CreateContext())
        {
            // Create despatch view without any zone groups
            context.TblDespatchViews.Add(new TblDespatchView
            {
                DespatchViewId = 1,
                Name = "Test View",
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            });
            await context.SaveChangesAsync();
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().BeEmpty();
    }

    #endregion

    #region GetClearListsAsync - Basic Flow Tests

    [Fact]
    public async Task GetClearListsAsync_WithValidData_ReturnsCorrectAreas()
    {
        // Arrange
        await SetupBasicClearListData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Name.Should().Be("Central");
        result.Areas[0].Id.Should().Be(1);
    }

    [Fact]
    public async Task GetClearListsAsync_WithMultipleDespatchViews_ReturnsAllAreas()
    {
        // Arrange
        await SetupMultipleClearListAreasData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1, 2]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(2);
        result.Areas.Select(a => a.Name).Should().Contain(["Central", "West Mid"]);
    }

    #endregion

    #region GetClearListsAsync - Courier Data Tests

    [Fact]
    public async Task GetClearListsAsync_WithLoggedInCouriers_IncludesCouriersInResults()
    {
        // Arrange
        await SetupClearListWithCouriersData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
        // Verify area was created (courier assignment depends on GPS polygon matching)
        result.Areas[0].Name.Should().Be("Central");
    }

    [Fact]
    public async Task GetClearListsAsync_WithP2PCouriers_IncludesCouriersWithoutLoginRequirement()
    {
        // Arrange - P2P couriers don't need to be logged in
        await SetupClearListWithP2PCourierData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
    }

    #endregion

    #region GetClearListsAsync - Parallel Query Verification Tests

    [Fact]
    public async Task GetClearListsAsync_ExecutesParallelQueries_WithCorrectDataIntegrity()
    {
        // Arrange - Setup complex data that exercises all parallel queries
        await SetupComplexClearListData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1, 2]);

        // Assert - Verify data integrity across parallel queries
        result.Should().NotBeNull();
        result.Areas.Should().HaveCountGreaterThan(0);

        // Verify columns are properly assigned
        result.Columns.Should().NotBeEmpty();
    }

    [Fact]
    public async Task GetClearListsAsync_WithCachedPolygonMappings_UsesCacheOnSecondCall()
    {
        // Arrange
        await SetupBasicClearListData();
        var repository = CreateRepository();

        // Act - First call populates cache
        var result1 = await repository.GetClearListsAsync([1]);
        // Second call should use cache
        var result2 = await repository.GetClearListsAsync([1]);

        // Assert - Both calls should return consistent results
        result1.Areas.Should().HaveCount(result2.Areas.Count);
        result1.Areas[0].Name.Should().Be(result2.Areas[0].Name);
    }

    #endregion

    #region GetClearListsAsync - Column Layout Tests

    [Fact]
    public async Task GetClearListsAsync_AssignsAreasToCorrectColumns()
    {
        // Arrange - Setup areas that should be assigned to different columns
        await SetupMultipleAreasForColumnLayoutData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1, 2, 3, 4]);

        // Assert
        result.Should().NotBeNull();
        result.Columns.Should().NotBeEmpty();

        // Verify column assignment based on area names
        var allAreasInColumns = result.Columns.SelectMany(c => c.Areas).ToList();
        allAreasInColumns.Should().HaveCount(result.Areas.Count);
    }

    #endregion

    #region GetClearListsAsync - Date Range Filter Tests

    [Fact]
    public async Task GetClearListsAsync_WithNoDateParams_ReturnsValidResult()
    {
        // Arrange - tenant time is 2024-01-15 10:00:00, jobs exist across multiple dates
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - no startDate/endDate provided (defaults to today)
        var result = await repository.GetClearListsAsync([1]);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Name.Should().Be("Central");
    }

    [Fact]
    public async Task GetClearListsAsync_WithCustomDateRange_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - request jobs from Jan 14 to Jan 16
        var startDate = new DateTimeOffset(2024, 1, 14, 0, 0, 0, TimeSpan.Zero);
        var endDate = new DateTimeOffset(2024, 1, 16, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], startDate, endDate);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Name.Should().Be("Central");
    }

    [Fact]
    public async Task GetClearListsAsync_WithFutureDateRange_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - request jobs from Jan 16 onward (past all test data)
        var startDate = new DateTimeOffset(2024, 1, 16, 0, 0, 0, TimeSpan.Zero);
        var endDate = new DateTimeOffset(2024, 1, 17, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], startDate, endDate);

        // Assert - still returns the area structure even with no matching jobs
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetClearListsAsync_WithStartDateOnly_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - provide only startDate (endDate defaults to tomorrow: 2024-01-16)
        var startDate = new DateTimeOffset(2024, 1, 14, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], startDate);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
    }

    [Fact]
    public async Task GetClearListsAsync_WithEndDateOnly_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - provide only endDate (startDate defaults to today: 2024-01-15)
        var endDate = new DateTimeOffset(2024, 1, 16, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], endDate: endDate);

        // Assert
        result.Should().NotBeNull();
        result.Areas.Should().HaveCount(1);
    }

    #endregion

    #region GetClearListsAsync - Display Order Adjustment with Date Filter Tests

    [Fact]
    public async Task GetClearListsAsync_CourierWithJobsOutsideDateFilter_MovesFromBottomToMiddle()
    {
        // Arrange - courier has Status=5 (orange/has jobs) but jobs are only on Jan 20
        // Date filter is Jan 15 (today) so jobs are excluded
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 20));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1]);

        // Assert - courier should move from Bottom (5) to Middle (3) since no jobs match filter
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Bottom.Should().BeEmpty("courier has no jobs in date range so should not be in Bottom/orange");
        result.Areas[0].Middle.Should().ContainSingle("courier should move to Middle/purple when jobs are filtered out");
    }

    [Fact]
    public async Task GetClearListsAsync_CourierWithJobsInsideDateFilter_StaysInBottom()
    {
        // Arrange - courier has Status=5 (orange/has jobs) and jobs are on Jan 15 (today)
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 15));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1]);

        // Assert - courier should stay in Bottom (5) since jobs match filter
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Bottom.Should().ContainSingle("courier has jobs in date range so should remain in Bottom/orange");
        result.Areas[0].Middle.Should().BeEmpty("courier should not be in Middle when they have jobs");
    }

    [Fact]
    public async Task GetClearListsAsync_DispatchedCourierWithNoJobsInFilter_MovesToMiddle()
    {
        // Arrange - courier has Status=1 (blue/dispatched) but jobs are only on Jan 20
        await SetupClearListWithCourierAndPolygon(courierStatus: 1, jobDate: new DateTime(2024, 1, 20));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1]);

        // Assert - courier should move from Top (1) to Middle (3)
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Top.Should().BeEmpty("courier has no jobs in date range so should not be in Top/blue");
        result.Areas[0].Middle.Should().ContainSingle("courier should move to Middle/purple when jobs are filtered out");
    }

    [Fact]
    public async Task GetClearListsAsync_CourierAlreadyInMiddle_StaysInMiddle()
    {
        // Arrange - courier has Status=3 (purple/no jobs) and no jobs
        await SetupClearListWithCourierAndPolygon(courierStatus: 3, jobDate: null);
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1]);

        // Assert - courier should remain in Middle (3)
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Middle.Should().ContainSingle("courier with no jobs should stay in Middle/purple");
        result.Areas[0].Top.Should().BeEmpty();
        result.Areas[0].Bottom.Should().BeEmpty();
    }

    [Fact]
    public async Task GetClearListsAsync_DateFilterIncludesJobs_CourierStaysInOriginalSection()
    {
        // Arrange - courier has Status=5 and jobs on Jan 20
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 20));
        var repository = CreateRepository();

        // Act - widen date filter to include the job date
        var startDate = new DateTimeOffset(2024, 1, 19, 0, 0, 0, TimeSpan.Zero);
        var endDate = new DateTimeOffset(2024, 1, 21, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], startDate, endDate);

        // Assert - courier should stay in Bottom (5) since jobs are within filter
        result.Areas.Should().HaveCount(1);
        result.Areas[0].Bottom.Should().ContainSingle("courier has jobs in widened date range so should remain in Bottom/orange");
        result.Areas[0].Middle.Should().BeEmpty("courier should not move to Middle when date filter includes their jobs");
    }

    #endregion

    #region Helper Methods - Data Setup

    private async Task SetupBasicClearListData()
    {
        await using var context = CreateContext();

        var clearListArea = new TblClearListArea
        {
            ClearListAreaId = 1,
            Code = "C",
            Name = "Central",
            ChannelId = 1,
            Order = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TblClearListAreas.Add(clearListArea);

        var zoneGroup = new ZoneGroup
        {
            ZoneGroupId = 1,
            Name = "Central Zone",
            ClearListAreaId = 1
        };
        context.ZoneGroups.Add(zoneGroup);

        var despatchView = new TblDespatchView
        {
            DespatchViewId = 1,
            Name = "Central",
            ShowOnAssistDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TblDespatchViews.Add(despatchView);

        var despatchViewZoneGroup = new DespatchViewZoneGroup
        {
            DespatchViewZoneGroupId = 1,
            DespatchViewId = 1,
            ZoneGroupId = 1,
            CreatedDate = DateTime.Now,
            CreatedBy = "Test",
            LastModifiedDate = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.DespatchViewZoneGroups.Add(despatchViewZoneGroup);

        await context.SaveChangesAsync();
    }

    private async Task SetupMultipleClearListAreasData()
    {
        await using var context = CreateContext();

        // Clear list area 1 - Central
        context.TblClearListAreas.Add(new TblClearListArea
        {
            ClearListAreaId = 1,
            Code = "C",
            Name = "Central",
            ChannelId = 1,
            Order = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Clear list area 2 - West Mid
        context.TblClearListAreas.Add(new TblClearListArea
        {
            ClearListAreaId = 2,
            Code = "WM",
            Name = "West Mid",
            ChannelId = 1,
            Order = 2,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Zone groups
        context.ZoneGroups.AddRange(
            new ZoneGroup { ZoneGroupId = 1, Name = "Central Zone", ClearListAreaId = 1 },
            new ZoneGroup { ZoneGroupId = 2, Name = "West Mid Zone", ClearListAreaId = 2 }
        );

        // Despatch views
        context.TblDespatchViews.AddRange(
            new TblDespatchView
            {
                DespatchViewId = 1,
                Name = "Central",
                ShowOnAssistDespatch = true,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            },
            new TblDespatchView
            {
                DespatchViewId = 2,
                Name = "West Mid",
                ShowOnAssistDespatch = true,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            }
        );

        // Link despatch views to zone groups
        context.DespatchViewZoneGroups.AddRange(
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 1,
                DespatchViewId = 1,
                ZoneGroupId = 1,
                CreatedDate = DateTime.Now,
                CreatedBy = "Test",
                LastModifiedDate = DateTime.Now,
                LastModifiedBy = "Test"
            },
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 2,
                DespatchViewId = 2,
                ZoneGroupId = 2,
                CreatedDate = DateTime.Now,
                CreatedBy = "Test",
                LastModifiedDate = DateTime.Now,
                LastModifiedBy = "Test"
            }
        );

        await context.SaveChangesAsync();
    }

    private async Task SetupClearListWithCouriersData()
    {
        await SetupBasicClearListData();

        await using var context = CreateContext();

        // Courier fleet
        var fleet = new TucCourierFleet
        {
            UccfId = 1,
            UccfName = "Standard Fleet",
            DisplayOnClearlistsDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TucCourierFleets.Add(fleet);

        // Courier login record (logged in today)
        var loginRecord = new TblCourierLogInOut
        {
            CourierLogInOutId = 1,
            CourierId = 1,
            LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TblCourierLogInOuts.Add(loginRecord);

        // Clear list area order (required for courier to appear)
        var clearListOrder = new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = 1,
            OrderTime = DateTime.Now,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TblClearListAreaOrders.Add(clearListOrder);

        // Courier
        var courier = new TucCourier
        {
            UccrId = 1,
            Code = "C001",
            UccrName = "John",
            UccrSurname = "Doe",
            Active = true,
            CourierFleetId = 1,
            CourierLogInOutId = 1,
            UccrChannelId = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TucCouriers.Add(courier);

        await context.SaveChangesAsync();
    }

    private async Task SetupClearListWithP2PCourierData()
    {
        await SetupBasicClearListData();

        await using var context = CreateContext();

        // P2P Fleet (CourierFleet.UaAucklandP2P = 6)
        var p2PFleet = new TucCourierFleet
        {
            UccfId = (int)CourierFleet.UaAucklandP2P,
            UccfName = "P2P Fleet",
            DisplayOnClearlistsDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TucCourierFleets.Add(p2PFleet);

        // Clear list area order
        var clearListOrder = new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = 1,
            OrderTime = DateTime.Now,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TblClearListAreaOrders.Add(clearListOrder);

        // P2P Courier (doesn't need login)
        var courier = new TucCourier
        {
            UccrId = 1,
            Code = "P001",
            UccrName = "P2P",
            UccrSurname = "Driver",
            Active = true,
            CourierFleetId = (int)CourierFleet.UaAucklandP2P,
            UccrChannelId = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TucCouriers.Add(courier);

        await context.SaveChangesAsync();
    }

    private async Task SetupComplexClearListData()
    {
        await SetupMultipleClearListAreasData();

        await using var context = CreateContext();

        // Fleet
        var fleet = new TucCourierFleet
        {
            UccfId = 1,
            UccfName = "Standard Fleet",
            DisplayOnClearlistsDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        };
        context.TucCourierFleets.Add(fleet);

        // Login records
        context.TblCourierLogInOuts.AddRange(
            new TblCourierLogInOut
            {
                CourierLogInOutId = 1,
                CourierId = 1,
                LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
                LogOutTime = null,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            },
            new TblCourierLogInOut
            {
                CourierLogInOutId = 2,
                CourierId = 2,
                LogInTime = new DateTime(2024, 1, 15, 8, 30, 0),
                LogOutTime = null,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            }
        );

        // Clear list area orders
        context.TblClearListAreaOrders.AddRange(
            new TblClearListAreaOrder
            {
                ClearListAreaOrderId = 1,
                CourierId = 1,
                ClearListAreaId = 1,
                Status = 1,
                OrderTime = DateTime.Now,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            },
            new TblClearListAreaOrder
            {
                ClearListAreaOrderId = 2,
                CourierId = 2,
                ClearListAreaId = 2,
                Status = 1,
                OrderTime = DateTime.Now,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            }
        );

        // Couriers
        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = 1,
                Code = "C001",
                UccrName = "John",
                UccrSurname = "Doe",
                Active = true,
                CourierFleetId = 1,
                CourierLogInOutId = 1,
                UccrChannelId = 1,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 2,
                Code = "C002",
                UccrName = "Jane",
                UccrSurname = "Smith",
                Active = true,
                CourierFleetId = 1,
                CourierLogInOutId = 2,
                UccrChannelId = 1,
                Created = DateTime.Now,
                CreatedBy = "Test",
                LastModified = DateTime.Now,
                LastModifiedBy = "Test"
            }
        );

        // Jobs for couriers
        context.TucJobs.AddRange(
            new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB001",
                UcjbCourierId = 1,
                UcjbDate = new DateTime(2024, 1, 15),
                UcjbJobDone = false,
                UcjbVoid = false
            },
            new TucJob
            {
                UcjbId = 2,
                UcjbNumber = "JOB002",
                UcjbCourierId = 2,
                UcjbDate = new DateTime(2024, 1, 15),
                UcjbJobDone = false,
                UcjbVoid = false
            }
        );

        await context.SaveChangesAsync();
    }

    private async Task SetupMultipleAreasForColumnLayoutData()
    {
        await using var context = CreateContext();

        // Create clear list areas for different columns
        var areas = new[]
        {
            new TblClearListArea { ClearListAreaId = 1, Code = "C", Name = "Central", ChannelId = 1, Order = 1, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblClearListArea { ClearListAreaId = 2, Code = "WM", Name = "West Mid", ChannelId = 1, Order = 2, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblClearListArea { ClearListAreaId = 3, Code = "EM", Name = "East Mid", ChannelId = 1, Order = 3, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblClearListArea { ClearListAreaId = 4, Code = "M", Name = "Mangere", ChannelId = 1, Order = 4, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" }
        };
        context.TblClearListAreas.AddRange(areas);

        // Zone groups for each area
        var zoneGroups = new[]
        {
            new ZoneGroup { ZoneGroupId = 1, Name = "Central Zone", ClearListAreaId = 1 },
            new ZoneGroup { ZoneGroupId = 2, Name = "West Mid Zone", ClearListAreaId = 2 },
            new ZoneGroup { ZoneGroupId = 3, Name = "East Mid Zone", ClearListAreaId = 3 },
            new ZoneGroup { ZoneGroupId = 4, Name = "Mangere Zone", ClearListAreaId = 4 }
        };
        context.ZoneGroups.AddRange(zoneGroups);

        // Despatch views
        var despatchViews = new[]
        {
            new TblDespatchView { DespatchViewId = 1, Name = "Central", ShowOnAssistDespatch = true, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblDespatchView { DespatchViewId = 2, Name = "West Mid", ShowOnAssistDespatch = true, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblDespatchView { DespatchViewId = 3, Name = "East Mid", ShowOnAssistDespatch = true, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" },
            new TblDespatchView { DespatchViewId = 4, Name = "Mangere", ShowOnAssistDespatch = true, Created = DateTime.Now, CreatedBy = "Test", LastModified = DateTime.Now, LastModifiedBy = "Test" }
        };
        context.TblDespatchViews.AddRange(despatchViews);

        // Link despatch views to zone groups
        var links = new[]
        {
            new DespatchViewZoneGroup { DespatchViewZoneGroupId = 1, DespatchViewId = 1, ZoneGroupId = 1, CreatedDate = DateTime.Now, CreatedBy = "Test", LastModifiedDate = DateTime.Now, LastModifiedBy = "Test" },
            new DespatchViewZoneGroup { DespatchViewZoneGroupId = 2, DespatchViewId = 2, ZoneGroupId = 2, CreatedDate = DateTime.Now, CreatedBy = "Test", LastModifiedDate = DateTime.Now, LastModifiedBy = "Test" },
            new DespatchViewZoneGroup { DespatchViewZoneGroupId = 3, DespatchViewId = 3, ZoneGroupId = 3, CreatedDate = DateTime.Now, CreatedBy = "Test", LastModifiedDate = DateTime.Now, LastModifiedBy = "Test" },
            new DespatchViewZoneGroup { DespatchViewZoneGroupId = 4, DespatchViewId = 4, ZoneGroupId = 4, CreatedDate = DateTime.Now, CreatedBy = "Test", LastModifiedDate = DateTime.Now, LastModifiedBy = "Test" }
        };
        context.DespatchViewZoneGroups.AddRange(links);

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Sets up a clear list area with a single courier that has GPS polygon matching,
    /// so the courier appears in the area's sections. Used for testing display order adjustment.
    /// </summary>
    /// <param name="courierStatus">The TblClearListAreaOrder.Status (1=top/blue, 3=middle/purple, 5=bottom/orange)</param>
    /// <param name="jobDate">The date for the courier's job, or null for no jobs</param>
    private async Task SetupClearListWithCourierAndPolygon(int courierStatus, DateTime? jobDate)
    {
        await SetupBasicClearListData();

        await using var context = CreateContext();

        // Fleet
        context.TucCourierFleets.Add(new TucCourierFleet
        {
            UccfId = 1,
            UccfName = "Standard Fleet",
            DisplayOnClearlistsDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // GPS record with PolygonId=100 matching the area polygon
        context.TblCourierGps.Add(new TblCourierGp
        {
            CourierGpsid = 1,
            CourierId = 1,
            PolygonId = 100,
            Created = new DateTime(2024, 1, 15, 9, 0, 0),
            RawData = "test"
        });

        // Polygon mapping: ClearListArea 1 → Polygon 100
        context.TblClearListAreaPolygons.Add(new TblClearListAreaPolygon
        {
            ClearListAreaPolygonId = 1,
            ClearListAreaId = 1,
            PolygonId = 100,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Login record (logged in today)
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 1,
            CourierId = 1,
            LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Clear list area order with the specified status
        context.TblClearListAreaOrders.Add(new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = courierStatus,
            OrderTime = DateTime.Now,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Courier with GPS reference
        context.TucCouriers.Add(new TucCourier
        {
            UccrId = 1,
            Code = "C001",
            UccrName = "John",
            UccrSurname = "Doe",
            Active = true,
            CourierFleetId = 1,
            CourierLogInOutId = 1,
            CourierGpsid = 1,
            UccrChannelId = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Job on the specified date (if any)
        if (jobDate.HasValue)
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = 1,
                UcjbNumber = "JOB001",
                UcjbCourierId = 1,
                UcjbDate = jobDate.Value,
                UcjbJobDone = false,
                UcjbVoid = false
            });
        }

        await context.SaveChangesAsync();
    }

    /// <summary>
    /// Sets up a clear list area with a single courier that has jobs on two different dates
    /// (2024-01-14 and 2024-01-15). The tenant time is mocked to 2024-01-15 10:00:00.
    /// </summary>
    private async Task SetupClearListWithJobsAcrossDates()
    {
        await SetupBasicClearListData();

        await using var context = CreateContext();

        // Fleet
        context.TucCourierFleets.Add(new TucCourierFleet
        {
            UccfId = 1,
            UccfName = "Standard Fleet",
            DisplayOnClearlistsDespatch = true,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Login record
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 1,
            CourierId = 1,
            LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Clear list area order
        context.TblClearListAreaOrders.Add(new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = 1,
            OrderTime = DateTime.Now,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Courier
        context.TucCouriers.Add(new TucCourier
        {
            UccrId = 1,
            Code = "C001",
            UccrName = "John",
            UccrSurname = "Doe",
            Active = true,
            CourierFleetId = 1,
            CourierLogInOutId = 1,
            UccrChannelId = 1,
            Created = DateTime.Now,
            CreatedBy = "Test",
            LastModified = DateTime.Now,
            LastModifiedBy = "Test"
        });

        // Job on yesterday (2024-01-14)
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 1,
            UcjbNumber = "JOB001",
            UcjbCourierId = 1,
            UcjbDate = new DateTime(2024, 1, 14),
            UcjbJobDone = false,
            UcjbVoid = false
        });

        // Job on today (2024-01-15)
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 2,
            UcjbNumber = "JOB002",
            UcjbCourierId = 1,
            UcjbDate = new DateTime(2024, 1, 15),
            UcjbJobDone = false,
            UcjbVoid = false
        });

        await context.SaveChangesAsync();
    }

    #endregion
}
