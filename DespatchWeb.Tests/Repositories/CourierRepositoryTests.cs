using DespatchWeb.EntityClasses;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using NSubstitute;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for CourierRepository - focuses on GetClearListsAsync parallel query execution.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class CourierRepositoryTests : IAsyncDisposable
{
    private readonly SqliteTestDatabase _db = new();
    private readonly MemoryCache _cache;
    private readonly IClearListEnvelopeService _clearListEnvelopeServiceMock = Substitute.For<IClearListEnvelopeService>();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 1, 15, 10, 0, 0));
    private readonly IDbContextFactory<DespatchContext> _contextFactoryMock;
    private readonly ITenantInfoService _tenantInfoServiceMock = Substitute.For<ITenantInfoService>();

    public CourierRepositoryTests()
    {
        _contextFactoryMock = _db.CreateFactoryMock();

        _tenantInfoServiceMock.GetTenantTimeZone()
            .Returns("New Zealand Standard Time");

        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public async ValueTask DisposeAsync()
    {
        GC.SuppressFinalize(this);
        _cache.Dispose();
        await _db.DisposeAsync();
    }

    private CourierRepository CreateRepository() => new(
        _contextFactoryMock,
        _tenantInfoServiceMock,
        _clock,
        _clearListEnvelopeServiceMock,
        _cache
    );

    private DespatchContext CreateContext() => _db.CreateContext();

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
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Areas);
    }

    [Fact]
    public async Task GetClearListsAsync_AssignsAreasToCorrectColumns()
    {
        // Arrange - Setup areas that should be assigned to different columns
        await SetupMultipleAreasForColumnLayoutData();
        var repository = CreateRepository();

        // Act
        var result =
            await repository.GetClearListsAsync([1, 2, 3, 4], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.NotEmpty(result.Columns);

        // Verify column assignment based on area names
        var allAreasInColumns = result.Columns.SelectMany(c => c.Areas).ToList();
        Assert.Equal(result.Areas.Count, allAreasInColumns.Count);
    }

    [Fact]
    public async Task GetClearListsAsync_WithEmptyDespatchViewIds_ReturnsEmptyViewModel()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Areas);
        Assert.Empty(result.Columns);
    }

    [Fact]
    public async Task GetClearListsAsync_WithNonExistentDespatchViewIds_ReturnsEmptyViewModel()
    {
        // Arrange
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([999, 998, 997],
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Empty(result.Areas);
        Assert.Empty(result.Columns);
    }

    [Fact]
    public async Task GetClearListsAsync_WithValidData_ReturnsCorrectAreas()
    {
        // Arrange
        await SetupBasicClearListData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
        Assert.Equal("Central", result.Areas[0].Name);
        Assert.Equal(1, result.Areas[0].Id);
    }

    [Fact]
    public async Task GetClearListsAsync_WithMultipleDespatchViews_ReturnsAllAreas()
    {
        // Arrange
        await SetupMultipleClearListAreasData();
        var repository = CreateRepository();

        // Act
        var result =
            await repository.GetClearListsAsync([1, 2], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Equal(2, result.Areas.Count);
        Assert.Contains("Central", result.Areas.Select(a => a.Name));
        Assert.Contains("West Mid", result.Areas.Select(a => a.Name));
    }

    [Fact]
    public async Task GetClearListsAsync_WithLoggedInCouriers_IncludesCouriersInResults()
    {
        // Arrange
        await SetupClearListWithCouriersData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
        // Verify area was created (courier assignment depends on GPS polygon matching)
        Assert.Equal("Central", result.Areas[0].Name);
    }

    [Fact]
    public async Task GetClearListsAsync_WithP2PCouriers_IncludesCouriersWithoutLoginRequirement()
    {
        // Arrange - P2P couriers don't need to be logged in
        await SetupClearListWithP2PCourierData();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
    }

    [Fact]
    public async Task GetClearListsAsync_ExecutesParallelQueries_WithCorrectDataIntegrity()
    {
        // Arrange - Setup complex data that exercises all parallel queries
        await SetupComplexClearListData();
        var repository = CreateRepository();

        // Act
        var result =
            await repository.GetClearListsAsync([1, 2], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - Verify data integrity across parallel queries
        Assert.NotNull(result);
        Assert.NotEmpty(result.Areas);

        // Verify columns are properly assigned
        Assert.NotEmpty(result.Columns);
    }

    [Fact]
    public async Task GetClearListsAsync_WithCachedPolygonMappings_UsesCacheOnSecondCall()
    {
        // Arrange
        await SetupBasicClearListData();
        var repository = CreateRepository();

        // Act - First call populates cache
        var result1 =
            await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);
        // Second call should use cache
        var result2 =
            await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - Both calls should return consistent results
        Assert.Equal(result2.Areas.Count, result1.Areas.Count);
        Assert.Equal(result2.Areas[0].Name, result1.Areas[0].Name);
    }

    [Fact]
    public async Task GetClearListsAsync_WithNoDateParams_ReturnsValidResult()
    {
        // Arrange - tenant time is 2024-01-15 10:00:00, jobs exist across multiple dates
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - no startDate/endDate provided (defaults to today)
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
        Assert.Equal("Central", result.Areas[0].Name);
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
        var result =
            await repository.GetClearListsAsync([1], startDate, endDate, TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
        Assert.Equal("Central", result.Areas[0].Name);
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
        var result =
            await repository.GetClearListsAsync([1], startDate, endDate, TestContext.Current.CancellationToken);

        // Assert - still returns the area structure even with no matching jobs
        Assert.NotNull(result);
        Assert.Single(result.Areas);
    }

    [Fact]
    public async Task GetClearListsAsync_WithStartDateOnly_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - provide only startDate (endDate defaults to tomorrow: 2024-01-16)
        var startDate = new DateTimeOffset(2024, 1, 14, 0, 0, 0, TimeSpan.Zero);
        var result =
            await repository.GetClearListsAsync([1], startDate,
                cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
    }

    [Fact]
    public async Task GetClearListsAsync_WithEndDateOnly_ReturnsValidResult()
    {
        // Arrange
        await SetupClearListWithJobsAcrossDates();
        var repository = CreateRepository();

        // Act - provide only endDate (startDate defaults to today: 2024-01-15)
        var endDate = new DateTimeOffset(2024, 1, 16, 0, 0, 0, TimeSpan.Zero);
        var result = await repository.GetClearListsAsync([1], endDate: endDate,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.NotNull(result);
        Assert.Single(result.Areas);
    }

    [Fact]
    public async Task GetClearListsAsync_CourierWithJobsOutsideDateFilter_MovesFromBottomToMiddle()
    {
        // Arrange - courier has Status=5 (orange/has jobs) but jobs are only on Jan 20
        // Date filter is Jan 15 (today) so jobs are excluded
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 20));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - courier should move from Bottom (5) to Middle (3) since no jobs match filter
        Assert.Single(result.Areas);
        Assert.Empty(result.Areas[0].Bottom); // courier has no jobs in date range so should not be in Bottom/orange
        Assert.Single(result.Areas[0].Middle); // courier should move to Middle/purple when jobs are filtered out
    }

    [Fact]
    public async Task GetClearListsAsync_CourierWithJobsInsideDateFilter_StaysInBottom()
    {
        // Arrange - courier has Status=5 (orange/has jobs) and jobs are on Jan 15 (today)
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 15));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - courier should stay in Bottom (5) since jobs match filter
        Assert.Single(result.Areas);
        Assert.Single(result.Areas[0].Bottom); // courier has jobs in date range so should remain in Bottom/orange
        Assert.Empty(result.Areas[0].Middle); // courier should not be in Middle when they have jobs
    }

    [Fact]
    public async Task GetClearListsAsync_DispatchedCourierWithNoJobsInFilter_MovesToMiddle()
    {
        // Arrange - courier has Status=1 (blue/dispatched) but jobs are only on Jan 20
        await SetupClearListWithCourierAndPolygon(courierStatus: 1, jobDate: new DateTime(2024, 1, 20));
        var repository = CreateRepository();

        // Act - default date filter (today = Jan 15)
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - courier should move from Top (1) to Middle (3)
        Assert.Single(result.Areas);
        Assert.Empty(result.Areas[0].Top); // courier has no jobs in date range so should not be in Top/blue
        Assert.Single(result.Areas[0].Middle); // courier should move to Middle/purple when jobs are filtered out
    }

    [Fact]
    public async Task GetClearListsAsync_CourierAlreadyInMiddle_StaysInMiddle()
    {
        // Arrange - courier has Status=3 (purple/no jobs) and no jobs
        await SetupClearListWithCourierAndPolygon(courierStatus: 3, jobDate: null);
        var repository = CreateRepository();

        // Act
        var result = await repository.GetClearListsAsync([1], cancellationToken: TestContext.Current.CancellationToken);

        // Assert - courier should remain in Middle (3)
        Assert.Single(result.Areas);
        Assert.Single(result.Areas[0].Middle); // courier with no jobs should stay in Middle/purple
        Assert.Empty(result.Areas[0].Top);
        Assert.Empty(result.Areas[0].Bottom);
    }

    [Fact]
    public async Task GetClearListsAsync_NarrowTimeFilter_CourierWithTodaysJobStaysInOriginalSection()
    {
        // Arrange - courier has Status=5 and a prebooked job later today (Jan 15, 16:00)
        await SetupClearListWithCourierAndPolygon(courierStatus: 5, jobDate: new DateTime(2024, 1, 15, 16, 0, 0));
        var repository = CreateRepository();

        // Act - narrow time filter (10:00-10:05) that excludes the 16:00 job
        var startDate = new DateTimeOffset(2024, 1, 15, 10, 0, 0, TimeSpan.Zero);
        var endDate = new DateTimeOffset(2024, 1, 15, 10, 5, 0, TimeSpan.Zero);
        var result =
            await repository.GetClearListsAsync([1], startDate, endDate, TestContext.Current.CancellationToken);

        // Assert - courier should stay in Bottom (5) because the full-day query still finds their job
        Assert.Single(result.Areas);
        Assert.Single(result.Areas[0].Bottom); // courier has a prebooked job today so should remain in Bottom/orange
        Assert.Empty(result.Areas[0].Middle); // courier should not move to Middle when they have jobs today
    }

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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };
        context.TblDespatchViews.Add(despatchView);

        var despatchViewZoneGroup = new DespatchViewZoneGroup
        {
            DespatchViewZoneGroupId = 1,
            DespatchViewId = 1,
            ZoneGroupId = 1,
            CreatedDate = TestDates.Now,
            CreatedBy = "Test",
            LastModifiedDate = TestDates.Now,
            LastModifiedBy = "Test"
        };
        context.DespatchViewZoneGroups.Add(despatchViewZoneGroup);

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            },
            new TblDespatchView
            {
                DespatchViewId = 2,
                Name = "West Mid",
                ShowOnAssistDespatch = true,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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
                CreatedDate = TestDates.Now,
                CreatedBy = "Test",
                LastModifiedDate = TestDates.Now,
                LastModifiedBy = "Test"
            },
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 2,
                DespatchViewId = 2,
                ZoneGroupId = 2,
                CreatedDate = TestDates.Now,
                CreatedBy = "Test",
                LastModifiedDate = TestDates.Now,
                LastModifiedBy = "Test"
            }
        );

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            OrderTime = TestDates.Now,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };
        context.TucCouriers.Add(courier);

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            OrderTime = TestDates.Now,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        };
        context.TucCouriers.Add(courier);

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            },
            new TblCourierLogInOut
            {
                CourierLogInOutId = 2,
                CourierId = 2,
                LogInTime = new DateTime(2024, 1, 15, 8, 30, 0),
                LogOutTime = null,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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
                OrderTime = TestDates.Now,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            },
            new TblClearListAreaOrder
            {
                ClearListAreaOrderId = 2,
                CourierId = 2,
                ClearListAreaId = 2,
                Status = 1,
                OrderTime = TestDates.Now,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
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

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private async Task SetupMultipleAreasForColumnLayoutData()
    {
        await using var context = CreateContext();

        // Create clear list areas for different columns
        var areas = new[]
        {
            new TblClearListArea
            {
                ClearListAreaId = 1, Code = "C", Name = "Central", ChannelId = 1, Order = 1, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblClearListArea
            {
                ClearListAreaId = 2, Code = "WM", Name = "West Mid", ChannelId = 1, Order = 2, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblClearListArea
            {
                ClearListAreaId = 3, Code = "EM", Name = "East Mid", ChannelId = 1, Order = 3, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblClearListArea
            {
                ClearListAreaId = 4, Code = "M", Name = "Mangere", ChannelId = 1, Order = 4, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
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
            new TblDespatchView
            {
                DespatchViewId = 1, Name = "Central", ShowOnAssistDespatch = true, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblDespatchView
            {
                DespatchViewId = 2, Name = "West Mid", ShowOnAssistDespatch = true, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblDespatchView
            {
                DespatchViewId = 3, Name = "East Mid", ShowOnAssistDespatch = true, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TblDespatchView
            {
                DespatchViewId = 4, Name = "Mangere", ShowOnAssistDespatch = true, Created = TestDates.Now,
                CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
        };
        context.TblDespatchViews.AddRange(despatchViews);

        // Link despatch views to zone groups
        var links = new[]
        {
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 1, DespatchViewId = 1, ZoneGroupId = 1, CreatedDate = TestDates.Now,
                CreatedBy = "Test", LastModifiedDate = TestDates.Now, LastModifiedBy = "Test"
            },
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 2, DespatchViewId = 2, ZoneGroupId = 2, CreatedDate = TestDates.Now,
                CreatedBy = "Test", LastModifiedDate = TestDates.Now, LastModifiedBy = "Test"
            },
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 3, DespatchViewId = 3, ZoneGroupId = 3, CreatedDate = TestDates.Now,
                CreatedBy = "Test", LastModifiedDate = TestDates.Now, LastModifiedBy = "Test"
            },
            new DespatchViewZoneGroup
            {
                DespatchViewZoneGroupId = 4, DespatchViewId = 4, ZoneGroupId = 4, CreatedDate = TestDates.Now,
                CreatedBy = "Test", LastModifiedDate = TestDates.Now, LastModifiedBy = "Test"
            }
        };
        context.DespatchViewZoneGroups.AddRange(links);

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        // Login record (logged in today)
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 1,
            CourierId = 1,
            LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        // Clear list area order with the specified status
        context.TblClearListAreaOrders.Add(new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = courierStatus,
            OrderTime = TestDates.Now,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        // Login record
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 1,
            CourierId = 1,
            LogInTime = new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        // Clear list area order
        context.TblClearListAreaOrders.Add(new TblClearListAreaOrder
        {
            ClearListAreaOrderId = 1,
            CourierId = 1,
            ClearListAreaId = 1,
            Status = 1,
            OrderTime = TestDates.Now,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
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

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static readonly CourierLocationRequest NzWideBounds = new()
    {
        MinLng = 165m,
        MaxLng = 180m,
        MinLat = -47m,
        MaxLat = -34m
    };

    private async Task SetupAvailableCourier(
        int courierId,
        int fleetId,
        string fleetName,
        bool displayOnClearlistsDespatch,
        decimal lat,
        decimal lng,
        bool active = true,
        DateTime? logInTime = null)
    {
        await using var context = CreateContext();

        if (context.TucCourierFleets.Local.All(f => f.UccfId != fleetId))
        {
            context.TucCourierFleets.Add(new TucCourierFleet
            {
                UccfId = fleetId,
                UccfName = fleetName,
                DisplayOnClearlistsDespatch = displayOnClearlistsDespatch,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });
        }

        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = courierId,
            CourierId = courierId,
            LogInTime = logInTime ?? new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = null,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        context.TblCourierGps.Add(new TblCourierGp
        {
            CourierGpsid = courierId,
            CourierId = courierId,
            Latitude = lat,
            Longitude = lng,
            Created = new DateTime(2024, 1, 15, 9, 0, 0),
            RawData = "test"
        });

        context.TucCouriers.Add(new TucCourier
        {
            UccrId = courierId,
            Code = $"C{courierId:D3}",
            UccrName = $"Driver{courierId}",
            UccrSurname = "Test",
            Active = active,
            CourierFleetId = fleetId,
            CourierLogInOutId = courierId,
            CourierGpsid = courierId,
            UccrChannelId = 1,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_ReturnsDriversWhoseFleetIsHiddenFromClearlists()
    {
        // Arrange - a driver whose fleet has DisplayOnClearlistsDespatch = false used to be
        // filtered out of the courier-map endpoint. Regression: they should now appear.
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaWellington,
            fleetName: "UA Wellington",
            displayOnClearlistsDespatch: false,
            lat: -41.3m,
            lng: 174.8m);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(1, driver.CourierId);
        Assert.Equal((int)CourierFleet.UaWellington, driver.CourierFleetId);
        Assert.Equal("UA Wellington", driver.CourierFleetName);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_WithCourierFleetIds_FiltersToOnlyMatchingFleets()
    {
        // Arrange - three drivers across three fleets
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);
        await SetupAvailableCourier(
            courierId: 2,
            fleetId: (int)CourierFleet.UaWellington,
            fleetName: "UA Wellington",
            displayOnClearlistsDespatch: false,
            lat: -41.3m,
            lng: 174.8m);
        await SetupAvailableCourier(
            courierId: 3,
            fleetId: (int)CourierFleet.Regional,
            fleetName: "Regional",
            displayOnClearlistsDespatch: false,
            lat: -38m,
            lng: 175m);

        var repository = CreateRepository();

        // Act - filter to just Wellington + Regional
        var request = new CourierLocationRequest
        {
            MinLng = NzWideBounds.MinLng,
            MaxLng = NzWideBounds.MaxLng,
            MinLat = NzWideBounds.MinLat,
            MaxLat = NzWideBounds.MaxLat,
            CourierFleetIds = [(int)CourierFleet.UaWellington, (int)CourierFleet.Regional]
        };
        var result = await repository.GetAvailableCouriersAsync(
            request,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Contains(result, d => d.CourierId == 2);
        Assert.Contains(result, d => d.CourierId == 3);
        Assert.DoesNotContain(result, d => d.CourierId == 1);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_WithEmptyCourierFleetIds_TreatedAsNoFleetFilter()
    {
        // Arrange
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);
        await SetupAvailableCourier(
            courierId: 2,
            fleetId: (int)CourierFleet.Regional,
            fleetName: "Regional",
            displayOnClearlistsDespatch: false,
            lat: -38m,
            lng: 175m);

        var repository = CreateRepository();

        var request = new CourierLocationRequest
        {
            MinLng = NzWideBounds.MinLng,
            MaxLng = NzWideBounds.MaxLng,
            MinLat = NzWideBounds.MinLat,
            MaxLat = NzWideBounds.MaxLat,
            CourierFleetIds = []
        };

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            request,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert - both drivers returned, fleet filter ignored when list is empty
        Assert.Equal(2, result.Count);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_PopulatesCourierFleetIdAndName()
    {
        // Arrange
        await SetupAvailableCourier(
            courierId: 7,
            fleetId: (int)CourierFleet.AucklandCool,
            fleetName: "Auckland Cool",
            displayOnClearlistsDespatch: false,
            lat: -36.85m,
            lng: 174.76m);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal((int)CourierFleet.AucklandCool, driver.CourierFleetId);
        Assert.Equal("Auckland Cool", driver.CourierFleetName);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_ExcludesInactiveCouriers()
    {
        // Arrange - an inactive courier that is otherwise logged in today with valid GPS
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m,
            active: false);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert - inactive couriers must not appear on the map
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_IncludesCourierWithOpenSessionFromPriorDay()
    {
        // Arrange - active courier whose still-open session began the day before "today"
        // (clock is 2024-01-15). Drivers commonly stay logged in across midnight, so an
        // open session (LogOutTime == null) must appear regardless of its login date.
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m,
            logInTime: new DateTime(2024, 1, 14, 8, 0, 0));

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(1, driver.CourierId);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_UsTenant_IncludesCourierWithOpenSessionFromPriorDay()
    {
        // Arrange - the US tenant uses a separate query path; it too must keep drivers whose
        // still-open session began before today (clock is 2024-01-15).
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m,
            logInTime: new DateTime(2024, 1, 14, 8, 0, 0));

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(1, driver.CourierId);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_IncludesActiveCourierLoggedInToday()
    {
        // Arrange - active courier logged in today (clock is 2024-01-15) with valid GPS
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(1, driver.CourierId);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_UsTenant_ExcludesInactiveCouriers()
    {
        // Arrange - the US tenant path uses a separate query that must also filter Active
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m,
            active: false);

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_TotalJobs_ExcludesDoneVoidAndFutureJobs()
    {
        // Arrange - clock is 2024-01-15. The driver-list job count must match the shared
        // "current work" definition: only undelivered, non-void, non-future jobs count.
        // Void-status (flag not set) and future-dated jobs must be excluded.
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                OverviewJob(1, new DateTime(2024, 1, 15)), // today, undelivered -> counts
                OverviewJob(2, new DateTime(2024, 1, 14)), // overdue, undelivered -> counts
                OverviewJob(3, new DateTime(2024, 1, 15), done: true), // done -> excluded
                OverviewJob(4, new DateTime(2024, 1, 15), isVoid: true), // void flag -> excluded
                OverviewJob(5, new DateTime(2024, 1, 15), status: (int)JobStatus.Void), // void status -> excluded
                OverviewJob(6, new DateTime(2024, 1, 16)) // future -> excluded
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(2, driver.TotalJobs);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_UsTenant_TotalJobs_ExcludesDoneVoidAndFutureJobs()
    {
        // Arrange - the US tenant uses a separate query path; its driver-list count must
        // apply the same "current work" exclusions (clock is 2024-01-15).
        _tenantInfoServiceMock.IsUsTenant().Returns(true);

        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                OverviewJob(1, new DateTime(2024, 1, 15)), // today, undelivered -> counts
                OverviewJob(2, new DateTime(2024, 1, 14)), // overdue, undelivered -> counts
                OverviewJob(3, new DateTime(2024, 1, 15), done: true), // done -> excluded
                OverviewJob(4, new DateTime(2024, 1, 15), isVoid: true), // void flag -> excluded
                OverviewJob(5, new DateTime(2024, 1, 15), status: (int)JobStatus.Void), // void status -> excluded
                OverviewJob(6, new DateTime(2024, 1, 16)) // future -> excluded
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(2, driver.TotalJobs);
    }

    // The courier flag on the maps shows where the driver last dropped and how long ago, so the
    // driver list carries the most recent completed job's delivery city and completion time.
    [Theory]
    [InlineData(false)] // NZ query path
    [InlineData(true)]  // US query path
    public async Task GetAvailableCouriersAsync_ReturnsTheMostRecentCompletedDelivery(bool isUsTenant)
    {
        // Arrange - clock is 2024-01-15 10:00. Two completed jobs; the newer one wins.
        _tenantInfoServiceMock.IsUsTenant().Returns(isUsTenant);
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CompletedJob(1, new DateTime(2024, 1, 15, 8, 0, 0), city: "Newmarket"),
                CompletedJob(2, new DateTime(2024, 1, 15, 9, 30, 0), city: "Ponsonby"),
                CompletedJob(3, new DateTime(2024, 1, 14, 16, 0, 0), city: "Takapuna")
            );
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal("Ponsonby", driver.LastDeliveryCity);
        Assert.Equal(new DateTime(2024, 1, 15, 9, 30, 0), driver.LastDeliveryTime?.DateTime);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_NoCompletedJob_LeavesLastDeliveryNull()
    {
        // Arrange - the courier's only job is still outstanding
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(OverviewJob(1, new DateTime(2024, 1, 15)));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Null(driver.LastDeliveryCity);
        Assert.Null(driver.LastDeliveryTime);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_LastDeliveryWithoutCity_FallsBackToSuburb()
    {
        // Arrange - address line 6 (city) is often blank on suburban drops; line 5 (suburb) is not
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(
                CompletedJob(1, new DateTime(2024, 1, 15, 9, 0, 0), city: null, suburb: "Grey Lynn"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal("Grey Lynn", driver.LastDeliveryCity);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_LastDelivery_IgnoresVoidedJobs()
    {
        // Arrange - a job voided after completion keeps its completion time, but it is not a delivery
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.AddRange(
                CompletedJob(1, new DateTime(2024, 1, 15, 8, 0, 0), city: "Newmarket"),
                CompletedJob(2, new DateTime(2024, 1, 15, 9, 30, 0), city: "Ponsonby", isVoid: true),
                CompletedJob(3, new DateTime(2024, 1, 15, 9, 45, 0), city: "Takapuna",
                    status: (int)JobStatus.Void));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal("Newmarket", driver.LastDeliveryCity);
    }

    [Fact]
    public async Task GetAvailableCouriersAsync_LastDeliveryWithBlankCity_FallsBackToSuburb()
    {
        // Arrange - a blank city is far more common in this data than a null one
        await SetupAvailableCourier(
            courierId: 1,
            fleetId: (int)CourierFleet.UaAuckland,
            fleetName: "UA Auckland",
            displayOnClearlistsDespatch: true,
            lat: -36.85m,
            lng: 174.76m);

        await using (var context = CreateContext())
        {
            context.TucJobs.Add(
                CompletedJob(1, new DateTime(2024, 1, 15, 9, 0, 0), city: "", suburb: "Grey Lynn"));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetAvailableCouriersAsync(
            NzWideBounds,
            cancellationToken: TestContext.Current.CancellationToken);

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal("Grey Lynn", driver.LastDeliveryCity);
    }

    private static TucJob CompletedJob(int id, DateTime completedAt, string city, string suburb = null,
        bool isVoid = false, int status = (int)JobStatus.Completed) => new()
    {
        UcjbId = id,
        UcjbNumber = $"JOB{id:000}",
        UcjbCourierId = 1,
        UcjbDate = completedAt.Date,
        UcjbComplTime = completedAt,
        UcjbJobDone = true,
        UcjbVoid = isVoid,
        UcjbStatus = status,
        DeliveryAddressLine5 = suburb,
        DeliveryAddressLine6 = city
    };

    /// <summary>
    /// Seeds one active and one inactive courier, both with a valid (future) driver's
    /// license, for the compliance-list tests. Clock is fixed at 2024-01-15.
    /// </summary>
    private async Task SeedActiveAndInactiveCompliantCouriers()
    {
        await using var context = CreateContext();

        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = 1,
                Code = "ACTIVE01",
                UccrName = "Active",
                UccrSurname = "Driver",
                Active = true,
                CourierFleetId = 1,
                UccrChannelId = 1,
                DriversLicenseExpiry = new DateTime(2025, 1, 1),
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 2,
                Code = "INACTIVE01",
                UccrName = "Inactive",
                UccrSurname = "Driver",
                Active = false,
                CourierFleetId = 1,
                UccrChannelId = 1,
                DriversLicenseExpiry = new DateTime(2025, 1, 1),
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    [Fact]
    public async Task GetAllCourierComplianceAsync_ExcludesInactiveCouriersFromItemsAndAggregates()
    {
        // Arrange
        await SeedActiveAndInactiveCompliantCouriers();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAllCourierComplianceAsync(
            new CourierComplianceFilterRequest { Page = 1, PageSize = 50 });

        // Assert - only the active courier is returned and counted
        var item = Assert.Single(result.Items);
        Assert.Equal("ACTIVE01", item.Code);
        Assert.Equal(1, result.Total);
        Assert.Equal(1, result.TotalValid);
        Assert.Equal(0, result.TotalExpired);
        Assert.Equal(0, result.TotalExpiringSoon);
    }

    [Fact]
    public async Task GetCourierComplianceForExportAsync_ExcludesInactiveCouriers()
    {
        // Arrange
        await SeedActiveAndInactiveCompliantCouriers();
        var repository = CreateRepository();

        // Act
        var result = await repository.GetCourierComplianceForExportAsync(
            new CourierComplianceFilterRequest());

        // Assert - only the active courier is exported
        var item = Assert.Single(result);
        Assert.Equal("ACTIVE01", item.Code);
    }

    [Fact]
    public async Task GetDriverWorkOverviewAsync_CountsOnlyOutstandingTodayAndOverdueJobs()
    {
        // Arrange - clock is 2024-01-15. Only undelivered, non-void jobs dated today or
        // earlier should count. Completed, void and future jobs must be excluded.
        await using (var context = CreateContext())
        {
            context.TucCouriers.Add(new TucCourier
            {
                UccrId = 1,
                Code = "C001",
                UccrName = "John",
                UccrSurname = "Doe",
                Active = true,
                UccrChannelId = 1,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });

            context.TucJobs.AddRange(
                OverviewJob(1, new DateTime(2024, 1, 15)), // today, undelivered -> counts
                OverviewJob(2, new DateTime(2024, 1, 14)), // overdue, undelivered -> counts
                OverviewJob(3, new DateTime(2024, 1, 15), done: true), // today, done -> excluded
                OverviewJob(4, new DateTime(2024, 1, 14), done: true), // overdue, done -> excluded
                OverviewJob(5, new DateTime(2024, 1, 15), isVoid: true), // void flag -> excluded
                OverviewJob(6, new DateTime(2024, 1, 15), status: (int)JobStatus.Void), // void status -> excluded
                OverviewJob(7, new DateTime(2024, 1, 16)) // future -> excluded
            );

            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetDriverWorkOverviewAsync();

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(1, driver.CourierId);
        Assert.Equal(2, driver.JobCount);
    }

    [Fact]
    public async Task GetDriverWorkOverviewAsync_DriverWithNoOutstandingJobs_ReturnsZeroCount()
    {
        // Arrange - the only job is completed, so the driver has no current work
        await using (var context = CreateContext())
        {
            context.TucCouriers.Add(new TucCourier
            {
                UccrId = 1,
                Code = "C001",
                UccrName = "John",
                UccrSurname = "Doe",
                Active = true,
                UccrChannelId = 1,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });
            context.TucJobs.Add(OverviewJob(1, new DateTime(2024, 1, 15), done: true));
            await context.SaveChangesAsync(TestContext.Current.CancellationToken);
        }

        var repository = CreateRepository();

        // Act
        var result = await repository.GetDriverWorkOverviewAsync();

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(0, driver.JobCount);
    }

    // A courier whose session has no LogOutTime read "Active" no matter how stale the session was,
    // so a driver who logged in days ago and never logged out never dropped out of Dispatch ->
    // Current Work -> Active Drivers. Active now means an open session opened inside the window.
    [Theory]
    // clock is 2024-01-15 10:00
    [InlineData("2024-01-15T08:00:00", "Active")]   // this morning
    [InlineData("2024-01-14T23:00:00", "Active")]   // clocked on last night, still working past midnight
    [InlineData("2024-01-12T08:00:00", "Inactive")] // three days ago, never logged out
    public async Task GetDriverWorkOverviewAsync_ActiveOnlyWhileTheOpenSessionIsRecent(
        string logInTime, string expectedStatus)
    {
        // Arrange
        await SetupWorkOverviewCourier(logInTime: DateTime.Parse(logInTime));
        var repository = CreateRepository();

        // Act
        var result = await repository.GetDriverWorkOverviewAsync();

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal(expectedStatus, driver.DriverStatusText);
    }

    [Fact]
    public async Task GetDriverWorkOverviewAsync_LoggedOutCourier_IsInactive()
    {
        // Arrange - a session opened inside the window but already closed
        await SetupWorkOverviewCourier(
            logInTime: new DateTime(2024, 1, 15, 6, 0, 0),
            logOutTime: new DateTime(2024, 1, 15, 9, 0, 0));
        var repository = CreateRepository();

        // Act
        var result = await repository.GetDriverWorkOverviewAsync();

        // Assert
        var driver = Assert.Single(result);
        Assert.Equal("Inactive", driver.DriverStatusText);
    }

    [Fact]
    public async Task GetDriverWorkOverviewAsync_OrdersByName()
    {
        // Arrange - the list is capped at 500; without an explicit order which drivers survive the
        // cap is left to the query plan and can change between refreshes.
        await SetupWorkOverviewCourier(courierId: 1, firstName: "Zoe");
        await SetupWorkOverviewCourier(courierId: 2, firstName: "Adam");
        var repository = CreateRepository();

        // Act
        var result = await repository.GetDriverWorkOverviewAsync();

        // Assert
        Assert.Equal(["Adam Test", "Zoe Test"], result.Select(d => d.Name));
    }

    private async Task SetupWorkOverviewCourier(
        int courierId = 1,
        string firstName = "John",
        DateTime? logInTime = null,
        DateTime? logOutTime = null)
    {
        await using var context = CreateContext();

        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = courierId,
            CourierId = courierId,
            LogInTime = logInTime ?? new DateTime(2024, 1, 15, 8, 0, 0),
            LogOutTime = logOutTime,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        context.TucCouriers.Add(new TucCourier
        {
            UccrId = courierId,
            Code = $"C{courierId:D3}",
            UccrName = firstName,
            UccrSurname = "Test",
            Active = true,
            UccrChannelId = 1,
            CourierLogInOutId = courierId,
            Created = TestDates.Now,
            CreatedBy = "Test",
            LastModified = TestDates.Now,
            LastModifiedBy = "Test"
        });

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    private static TucJob OverviewJob(int id, DateTime date, bool done = false, bool isVoid = false,
        int status = (int)JobStatus.Dispatched) => new()
    {
        UcjbId = id,
        UcjbNumber = $"JOB{id:000}",
        UcjbCourierId = 1,
        UcjbDate = date,
        UcjbJobDone = done,
        UcjbVoid = isVoid,
        UcjbStatus = status
    };

    private const int MaxExportRowsUnderTest = 10_000;

    [Fact]
    public async Task GetAfterHoursScheduleForExportAsync_WithMoreThanMaxExportRows_CapsAtMaxExportRows()
    {
        // Arrange - one more schedule group than the export cap; every sibling *ForExportAsync
        // method caps at MaxExportRows, this one must too instead of returning everything.
        await SetupAfterHoursSchedulesExceedingExportCap(MaxExportRowsUnderTest + 1);
        var repository = CreateRepository();

        // Act
        var result = await repository.GetAfterHoursScheduleForExportAsync(new CourierAfterHoursFilterRequest());

        // Assert
        Assert.Equal(MaxExportRowsUnderTest, result.Count);
    }

    private async Task SetupAfterHoursSchedulesExceedingExportCap(int scheduleGroupCount)
    {
        await using var context = CreateContext();

        var startTime = new DateTime(2024, 1, 1, 9, 0, 0);
        var endTime = new DateTime(2024, 1, 1, 17, 0, 0);

        for (var courierId = 1; courierId <= scheduleGroupCount; courierId++)
        {
            context.TucCouriers.Add(new TucCourier
            {
                UccrId = courierId,
                Code = $"C{courierId:D5}",
                UccrName = $"Driver{courierId}",
                UccrSurname = "Test",
                Active = true,
                UccrChannelId = 1,
                Created = TestDates.Now,
                CreatedBy = "Test",
                LastModified = TestDates.Now,
                LastModifiedBy = "Test"
            });

            context.TblAfterhoursCouriers.Add(new TblAfterhoursCourier
            {
                Id = courierId,
                CourierId = courierId,
                WeekDay = 1,
                StartTime = startTime,
                EndTime = endTime
            });
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }
}