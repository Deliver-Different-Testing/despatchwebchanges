using DespatchWeb.EntityClasses;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Repositories;
using FluentAssertions;
using Microsoft.Data.Sqlite;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Moq;

namespace DespatchWeb.Tests.Repositories;

/// <summary>
/// Tests for CourierRepository sorting — GetCourierEmailsAsync and GetCourierDailyEarningsAsync.
/// Uses SQLite in-memory database to test repository operations.
/// </summary>
public class CourierRepositorySortingTests : IAsyncDisposable
{
    private readonly IMemoryCache _cache;
    private readonly Mock<IClearListEnvelopeService> _clearListEnvelopeServiceMock = new();
    private readonly SqliteConnection _connection;
    private readonly Mock<IDbContextFactory<DespatchContext>> _contextFactoryMock = new();
    private readonly DbContextOptions<DespatchContext> _contextOptions;
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly FakeTenantClock _clock = new(new DateTime(2024, 1, 15, 10, 0, 0));

    public CourierRepositorySortingTests()
    {
        _connection = new SqliteConnection("DataSource=:memory:");
        _connection.Open();

        _connection.CreateFunction("getdate", () => TestDates.Now);

        using (var command = _connection.CreateCommand())
        {
            command.CommandText = "PRAGMA foreign_keys = OFF;";
            command.ExecuteNonQuery();
        }

        _contextOptions = new DbContextOptionsBuilder<DespatchContext>()
            .UseSqlite(_connection)
            .Options;

        using var context = new DespatchContext(_contextOptions);
        context.Database.EnsureCreated();

        _contextFactoryMock
            .Setup(f => f.CreateDbContext())
            .Returns(() => new DespatchContext(_contextOptions));
        _contextFactoryMock
            .Setup(f => f.CreateDbContextAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(() => new DespatchContext(_contextOptions));

        _tenantInfoServiceMock
            .Setup(x => x.GetTenantTimeZone())
            .Returns("New Zealand Standard Time");

        _cache = new MemoryCache(new MemoryCacheOptions());
    }

    public async ValueTask DisposeAsync()
    {
        _cache.Dispose();
        await _connection.DisposeAsync();
    }

    private CourierRepository CreateRepository() => new(
        _contextFactoryMock.Object,
        _tenantInfoServiceMock.Object,
        _clock,
        _clearListEnvelopeServiceMock.Object,
        _cache
    );

    private DespatchContext CreateContext() => new(_contextOptions);

    #region Seed Helpers

    /// <summary>
    /// Seeds 3 couriers with non-null emails + 2 fleets.
    /// Values chosen so every sort column produces a different order:
    /// - C01 / Alice Zara / a@test.com / 111 / Alpha fleet
    /// - A02 / Bob Young / c@test.com / 333 / Gamma fleet
    /// - B03 / Carol Xena / b@test.com / 222 / Beta fleet
    /// </summary>
    private async Task SeedEmailCouriersAsync()
    {
        await using var context = CreateContext();

        context.TucCourierFleets.AddRange(
            new TucCourierFleet
            {
                UccfId = 1, UccfName = "Alpha fleet",
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourierFleet
            {
                UccfId = 2, UccfName = "Beta fleet",
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourierFleet
            {
                UccfId = 3, UccfName = "Gamma fleet",
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
        );

        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = 1, Code = "C01", UccrName = "Alice", UccrSurname = "Zara",
                UccrEmail = "a@test.com", UccrMobile = "111", CourierFleetId = 1,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 2, Code = "A02", UccrName = "Bob", UccrSurname = "Young",
                UccrEmail = "c@test.com", UccrMobile = "333", CourierFleetId = 3,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 3, Code = "B03", UccrName = "Carol", UccrSurname = "Xena",
                UccrEmail = "b@test.com", UccrMobile = "222", CourierFleetId = 2,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
        );

        // Extra couriers with null emails (should be excluded from email query)
        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = 4, Code = "D04", UccrName = "Dave", UccrSurname = "Wilson",
                UccrEmail = null, UccrMobile = "444", CourierFleetId = 1,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 5, Code = "E05", UccrName = "Eve", UccrSurname = "Thomas",
                UccrEmail = null, UccrMobile = "555", CourierFleetId = 2,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
        );

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    /// <summary>
    /// Seeds 3 couriers with TblCourierLogInOut (LogInTime on TenantNow.Date) + TucJob rows.
    /// Distinct computed values:
    /// - Zara: 240min logged, 3 deliveries, $60 earnings, $15/hr
    /// - Alice: 480min logged, 1 delivery, $100 earnings, $12.50/hr
    /// - Mike: 120min logged, 5 deliveries, $50 earnings, $25/hr
    /// </summary>
    private async Task SeedEarningsCouriersAsync()
    {
        await using var context = CreateContext();

        var today = new DateTime(2024, 1, 15);
        var now = new DateTime(2024, 1, 15, 10, 0, 0);

        // Login records — LogInTime determines hours logged (LogOutTime=null → uses TenantNow)
        // Zara: login 06:00, now 10:00 → 240 min
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 1, CourierId = 1,
            LogInTime = today.AddHours(6), LogOutTime = null,
            Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
        });
        // Alice: login 02:00, now 10:00 → 480 min
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 2, CourierId = 2,
            LogInTime = today.AddHours(2), LogOutTime = null,
            Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
        });
        // Mike: login 08:00, now 10:00 → 120 min
        context.TblCourierLogInOuts.Add(new TblCourierLogInOut
        {
            CourierLogInOutId = 3, CourierId = 3,
            LogInTime = today.AddHours(8), LogOutTime = null,
            Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
        });

        // Couriers
        context.TucCouriers.AddRange(
            new TucCourier
            {
                UccrId = 1, Code = "Z01", UccrName = "Zara", UccrSurname = "Adams",
                CourierLogInOutId = 1,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 2, Code = "A02", UccrName = "Alice", UccrSurname = "Brown",
                CourierLogInOutId = 2,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            },
            new TucCourier
            {
                UccrId = 3, Code = "M03", UccrName = "Mike", UccrSurname = "Carter",
                CourierLogInOutId = 3,
                Created = TestDates.Now, CreatedBy = "Test", LastModified = TestDates.Now, LastModifiedBy = "Test"
            }
        );

        // Jobs — Zara: 3 jobs @ $20 = $60
        for (var i = 1; i <= 3; i++)
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = i, UcjbNumber = $"JOB{i:D3}",
                UcjbCourierId = 1, UcjbDate = today,
                UcjbComplTime = now.AddMinutes(-i),
                CourierPayment = 20m
            });
        }

        // Alice: 1 job @ $100
        context.TucJobs.Add(new TucJob
        {
            UcjbId = 4, UcjbNumber = "JOB004",
            UcjbCourierId = 2, UcjbDate = today,
            UcjbComplTime = now.AddMinutes(-10),
            CourierPayment = 100m
        });

        // Mike: 5 jobs @ $10 = $50
        for (var i = 5; i <= 9; i++)
        {
            context.TucJobs.Add(new TucJob
            {
                UcjbId = i, UcjbNumber = $"JOB{i:D3}",
                UcjbCourierId = 3, UcjbDate = today,
                UcjbComplTime = now.AddMinutes(-i),
                CourierPayment = 10m
            });
        }

        await context.SaveChangesAsync(TestContext.Current.CancellationToken);
    }

    #endregion

    #region GetCourierEmailsAsync Sorting Tests

    [Fact]
    public async Task GetCourierEmailsAsync_DefaultSort_ReturnsNameAsc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100 };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Should().HaveCount(3);
        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Zara", "Bob Young", "Carol Xena");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_DefaultSort_Desc_ReturnsNameDesc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Carol Xena", "Bob Young", "Alice Zara");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByCode_Asc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "code" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Code).Should().ContainInConsecutiveOrder("A02", "B03", "C01");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByCode_Desc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "code", SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Code).Should().ContainInConsecutiveOrder("C01", "B03", "A02");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByEmail_Asc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "email" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Email).Should().ContainInConsecutiveOrder("a@test.com", "b@test.com", "c@test.com");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByEmail_Desc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "email", SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Email).Should().ContainInConsecutiveOrder("c@test.com", "b@test.com", "a@test.com");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByPhone_Asc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "phone" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Phone).Should().ContainInConsecutiveOrder("111", "222", "333");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByPhone_Desc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "phone", SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Phone).Should().ContainInConsecutiveOrder("333", "222", "111");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByFleet_Asc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "fleet" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Fleet).Should()
            .ContainInConsecutiveOrder("Alpha fleet", "Beta fleet", "Gamma fleet");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByFleet_Desc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "fleet", SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Fleet).Should()
            .ContainInConsecutiveOrder("Gamma fleet", "Beta fleet", "Alpha fleet");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByName_Asc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "name" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Zara", "Bob Young", "Carol Xena");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortByName_Desc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "name", SortDescending = true };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Carol Xena", "Bob Young", "Alice Zara");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_UnrecognisedOrderBy_FallsBackToNameAsc()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "nonexistent" };

        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Zara", "Bob Young", "Carol Xena");
    }

    [Fact]
    public async Task GetCourierEmailsAsync_SortAppliedBeforePagination_ReturnsCorrectSlice()
    {
        await SeedEmailCouriersAsync();
        var repository = CreateRepository();

        // Sort by code asc → A02, B03, C01. Page 1, size 2 → A02, B03
        var request = new PaginatedRequest { Page = 1, PageSize = 2, OrderBy = "code" };
        var result = await repository.GetCourierEmailsAsync(request);

        result.Items.Should().HaveCount(2);
        result.Items.Select(x => x.Code).Should().ContainInConsecutiveOrder("A02", "B03");
        result.Total.Should().Be(3);
        result.Pages.Should().Be(2);

        // Page 2, size 2 → C01
        var request2 = new PaginatedRequest { Page = 2, PageSize = 2, OrderBy = "code" };
        var result2 = await repository.GetCourierEmailsAsync(request2);

        result2.Items.Should().HaveCount(1);
        result2.Items.First().Code.Should().Be("C01");
    }

    #endregion

    #region GetCourierDailyEarningsAsync Sorting Tests

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByName_Asc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "name" };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Should().HaveCount(3);
        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Brown", "Mike Carter", "Zara Adams");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByName_Desc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "name", SortDescending = true };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Zara Adams", "Mike Carter", "Alice Brown");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_DefaultSort_FallsBackToNameAsc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100 };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Brown", "Mike Carter", "Zara Adams");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByName_Pagination()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();

        // Name asc → Alice, Mike, Zara. Page 1 size 2 → Alice, Mike
        var request = new PaginatedRequest { Page = 1, PageSize = 2, OrderBy = "name" };
        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Should().HaveCount(2);
        result.Items.Select(x => x.Name).Should().ContainInConsecutiveOrder("Alice Brown", "Mike Carter");
        result.Total.Should().Be(3);

        // Page 2 → Zara
        var request2 = new PaginatedRequest { Page = 2, PageSize = 2, OrderBy = "name" };
        var result2 = await repository.GetCourierDailyEarningsAsync(request2);

        result2.Items.Should().HaveCount(1);
        result2.Items.First().Name.Should().Be("Zara Adams");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByHoursLogged_Asc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "hourslogged" };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        // Mike: 120min, Zara: 240min, Alice: 480min
        result.Items.Select(x => x.HoursLogged).Should().BeInAscendingOrder();
        result.Items.First().Name.Should().Be("Mike Carter");
        result.Items.Last().Name.Should().Be("Alice Brown");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByHoursLogged_Desc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "hourslogged", SortDescending = true };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.HoursLogged).Should().BeInDescendingOrder();
        result.Items.First().Name.Should().Be("Alice Brown");
        result.Items.Last().Name.Should().Be("Mike Carter");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByDeliveries_Asc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "deliveries" };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        // Alice: 1, Zara: 3, Mike: 5
        result.Items.Select(x => x.Deliveries).Should().BeInAscendingOrder();
        result.Items.First().Name.Should().Be("Alice Brown");
        result.Items.Last().Name.Should().Be("Mike Carter");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByDeliveries_Desc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "deliveries", SortDescending = true };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.Deliveries).Should().BeInDescendingOrder();
        result.Items.First().Name.Should().Be("Mike Carter");
        result.Items.Last().Name.Should().Be("Alice Brown");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByEarnings_Asc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "earnings" };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        // Mike: $50, Zara: $60, Alice: $100
        result.Items.Select(x => x.Earnings).Should().BeInAscendingOrder();
        result.Items.First().Name.Should().Be("Mike Carter");
        result.Items.Last().Name.Should().Be("Alice Brown");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByEarnings_Desc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "earnings", SortDescending = true };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.Earnings).Should().BeInDescendingOrder();
        result.Items.First().Name.Should().Be("Alice Brown");
        result.Items.Last().Name.Should().Be("Mike Carter");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByHourlyRate_Asc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "hourlyrate" };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        // Alice: $12.50/hr, Zara: $15/hr, Mike: $25/hr
        result.Items.Select(x => x.HourlyRate).Should().BeInAscendingOrder();
        result.Items.First().Name.Should().Be("Alice Brown");
        result.Items.Last().Name.Should().Be("Mike Carter");
    }

    [Fact]
    public async Task GetCourierDailyEarningsAsync_SortByHourlyRate_Desc()
    {
        await SeedEarningsCouriersAsync();
        var repository = CreateRepository();
        var request = new PaginatedRequest { Page = 1, PageSize = 100, OrderBy = "hourlyrate", SortDescending = true };

        var result = await repository.GetCourierDailyEarningsAsync(request);

        result.Items.Select(x => x.HourlyRate).Should().BeInDescendingOrder();
        result.Items.First().Name.Should().Be("Mike Carter");
        result.Items.Last().Name.Should().Be("Alice Brown");
    }

    #endregion
}