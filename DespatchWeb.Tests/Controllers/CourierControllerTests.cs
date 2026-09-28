using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for CourierController - tests courier-related endpoints.
/// </summary>
public class CourierControllerTests
{
    private readonly ICourierRepository _courierRepository = Substitute.For<ICourierRepository>();
    private readonly ITenantInfoService _tenantInfoService = Substitute.For<ITenantInfoService>();
    private readonly ITaskRepository _taskRepository = Substitute.For<ITaskRepository>();
    private readonly ICourierReportService _courierReportService = Substitute.For<ICourierReportService>();

    private CourierController CreateController() =>
        new(
            _courierRepository,
            _tenantInfoService,
            _taskRepository,
            _courierReportService);

    [Fact]
    public async Task AllActiveSearch_MultipleCouriersReturned_ReturnsAllInCorrectOrder()
    {
        // Arrange
        const string searchTerm = "courier";
        IReadOnlyList<Suggestion> expectedCouriers =
        [
            new() { Id = 1, Text = "001 (Courier Alpha)" },
            new() { Id = 2, Text = "002 (Courier Beta)" },
            new() { Id = 3, Text = "003 (Courier Charlie)" }
        ];

        _courierRepository.AllActiveCouriersAsync(searchTerm, false, true).Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_ValidSearchTerm_ReturnsCouriers()
    {
        // Arrange
        const string searchTerm = "john";
        IReadOnlyList<Suggestion> expectedCouriers =
        [
            new() { Id = 1, Text = "001 (John Doe)" },
            new() { Id = 2, Text = "002 (Johnny Smith)" }
        ];

        _courierRepository.AllActiveCouriersAsync(searchTerm)
            .Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_DgOnlyTrue_PassesDgOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        IReadOnlyList<Suggestion> expectedCouriers =
        [
            new() { Id = 1, Text = "001 (DG Courier)" }
        ];

        _courierRepository.AllActiveCouriersAsync(searchTerm, true).Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true);

        // Assert
        await _courierRepository
            .Received(1)
            .AllActiveCouriersAsync(searchTerm, true);
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyTrue_PassesLoggedInOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        IReadOnlyList<Suggestion> expectedCouriers =
        [
            new() { Id = 1, Text = "001 (Logged In Courier)" }
        ];

        _courierRepository.AllActiveCouriersAsync(searchTerm, false, true).Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        await _courierRepository
            .Received(1)
            .AllActiveCouriersAsync(searchTerm, false, true);
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_BothDgOnlyAndLoggedInOnlyTrue_PassesBothToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        IReadOnlyList<Suggestion> expectedCouriers =
        [
            new() { Id = 1, Text = "001 (DG Logged In Courier)" }
        ];

        _courierRepository.AllActiveCouriersAsync(searchTerm, true, true).Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true, loggedInOnly: true);

        // Assert
        await _courierRepository
            .Received(1)
            .AllActiveCouriersAsync(searchTerm, true, true);
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_DefaultParameters_BothFlagsAreFalse()
    {
        // Arrange
        const string searchTerm = "test";

        _courierRepository.AllActiveCouriersAsync(searchTerm).Returns(Array.Empty<Suggestion>());

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert - Verify default values are false
        await _courierRepository
            .Received(1).AllActiveCouriersAsync(searchTerm);
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyReturnsEmpty_ReturnsEmptyList()
    {
        // Arrange
        const string searchTerm = "test";
        IReadOnlyList<Suggestion> expectedCouriers = [];

        _courierRepository.AllActiveCouriersAsync(searchTerm, false, true).Returns(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        var jsonResult = Assert.IsType<JsonResult>(result);
        Assert.Equal(expectedCouriers, jsonResult.Value);
    }

    [Fact]
    public async Task AllActiveSearch_RepositoryThrowsException_Returns500()
    {
        // Arrange
        const string searchTerm = "test";

        _courierRepository.AllActiveCouriersAsync(searchTerm)
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task AllActiveSearch_EmptySearchTerm_StillCallsRepository()
    {
        // Arrange
        const string searchTerm = "";

        _courierRepository.AllActiveCouriersAsync(searchTerm).Returns(Array.Empty<Suggestion>());

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert
        await _courierRepository
            .Received(1)
            .AllActiveCouriersAsync(searchTerm);
    }

    [Fact]
    public async Task AllActiveSearch_NullSearchTerm_StillCallsRepository()
    {
        // Arrange
        string? searchTerm = null;

        _courierRepository.AllActiveCouriersAsync(searchTerm!).Returns(Array.Empty<Suggestion>());

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm!);

        // Assert
        await _courierRepository
            .Received(1)
            .AllActiveCouriersAsync(searchTerm!);
    }

    [Fact]
    public async Task Index_WithNoDates_PassesNullDatesToRepository()
    {
        // Arrange
        var despatchViewIds = new List<int> { 1, 2 };
        var expectedResult = new ClearListViewModel();

        _courierRepository.GetClearListsAsync(despatchViewIds, null, null, Arg.Any<CancellationToken>())
            .Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(despatchViewIds);

        // Assert
        await _courierRepository
            .Received(1)
            .GetClearListsAsync(despatchViewIds, null, null, Arg.Any<CancellationToken>());
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Index_WithDateRange_PassesDatesToRepository()
    {
        // Arrange
        var despatchViewIds = new List<int> { 1 };
        var startDate = new DateTimeOffset(2024, 1, 14, 0, 0, 0, TimeSpan.Zero);
        var endDate = new DateTimeOffset(2024, 1, 16, 0, 0, 0, TimeSpan.Zero);
        var expectedResult = new ClearListViewModel();

        _courierRepository.GetClearListsAsync(despatchViewIds, startDate, endDate, Arg.Any<CancellationToken>())
            .Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(despatchViewIds, startDate, endDate);

        // Assert
        await _courierRepository
            .Received(1)
            .GetClearListsAsync(despatchViewIds, startDate, endDate, Arg.Any<CancellationToken>());

        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Index_WithNullDespatchViewIds_DefaultsToFallbackId()
    {
        // Arrange
        var expectedResult = new ClearListViewModel();

        _courierRepository.GetClearListsAsync(Arg.Any<IReadOnlyList<int>>(), null, null, Arg.Any<CancellationToken>())
            .Returns(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(null!);

        // Assert
        await _courierRepository
            .Received(1)
            .GetClearListsAsync(Arg.Any<IReadOnlyList<int>>(), null, null, Arg.Any<CancellationToken>());
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Index_RepositoryThrowsException_Returns500()
    {
        // Arrange
        var despatchViewIds = new List<int> { 1 };

        _courierRepository.GetClearListsAsync(despatchViewIds, null, null, Arg.Any<CancellationToken>())
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.Index(despatchViewIds);

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task ExportTodayActiveDriversCsv_Success_ReturnsFileResult()
    {
        // Arrange
        var csvBytes = "Code,Name\nC001,John"u8.ToArray();
        const string fileName = "today-active-drivers-2026-02-18-1430.csv";

        _courierReportService
            .GenerateTodayActiveDriversCsvAsync(Arg.Any<TodayActiveDriversFilterRequest>())
            .Returns((csvBytes, fileName));

        var controller = CreateController();

        // Act
        var result = await controller.ExportTodayActiveDriversCsv(new TodayActiveDriversFilterRequest());

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal(fileName, fileResult.FileDownloadName);
        Assert.Equivalent(csvBytes, fileResult.FileContents);
    }

    [Fact]
    public async Task ExportTodayActiveDriversCsv_ServiceThrows_Returns500()
    {
        // Arrange
        _courierReportService
            .GenerateTodayActiveDriversCsvAsync(Arg.Any<TodayActiveDriversFilterRequest>())
            .ThrowsAsync(new Exception("Export failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ExportTodayActiveDriversCsv(new TodayActiveDriversFilterRequest());

        // Assert
        Assert.IsType<ObjectResult>(result);
        var objectResult = (ObjectResult)result;
        Assert.Equal(500, objectResult.StatusCode);
    }

    [Fact]
    public async Task ExportComplianceCsv_Success_ReturnsFileResult()
    {
        // Arrange
        var csvBytes = "Code,Name\nC001,John"u8.ToArray();
        const string fileName = "driver-compliance-2026-02-18-1430.csv";

        _courierReportService.GenerateComplianceCsvAsync(Arg.Any<CourierComplianceFilterRequest>())
            .Returns((csvBytes, fileName));

        var controller = CreateController();

        // Act
        var result = await controller.ExportComplianceCsv(new CourierComplianceFilterRequest());

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal(fileName, fileResult.FileDownloadName);
    }

    [Fact]
    public async Task ExportComplianceCsv_ServiceThrows_Returns500()
    {
        // Arrange
        _courierReportService.GenerateComplianceCsvAsync(Arg.Any<CourierComplianceFilterRequest>())
            .ThrowsAsync(new Exception("Export failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ExportComplianceCsv(new CourierComplianceFilterRequest());

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task ExportAfterHoursScheduleCsv_Success_ReturnsFileResult()
    {
        // Arrange
        var csvBytes = "Driver Name,Driver Code\nJohn,C001"u8.ToArray();
        const string fileName = "after-hours-schedule-2026-02-18-1430.csv";

        _courierReportService
            .GenerateAfterHoursScheduleCsvAsync(Arg.Any<CourierAfterHoursFilterRequest>())
            .Returns((csvBytes, fileName));

        var controller = CreateController();

        // Act
        var result = await controller.ExportAfterHoursScheduleCsv(new CourierAfterHoursFilterRequest());

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal(fileName, fileResult.FileDownloadName);
    }

    [Fact]
    public async Task ExportAfterHoursScheduleCsv_ServiceThrows_Returns500()
    {
        // Arrange
        _courierReportService
            .GenerateAfterHoursScheduleCsvAsync(Arg.Any<CourierAfterHoursFilterRequest>())
            .ThrowsAsync(new Exception("Export failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ExportAfterHoursScheduleCsv(new CourierAfterHoursFilterRequest());

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task ExportDriverEmailsCsv_Success_ReturnsFileResult()
    {
        // Arrange
        var csvBytes = "Code,Name,Email\nC001,John,john@test.com"u8.ToArray();
        const string fileName = "driver-emails-2026-02-18-1430.csv";

        _courierReportService.GenerateDriverEmailsCsvAsync(Arg.Any<PaginatedRequest>()).Returns((csvBytes, fileName));

        var controller = CreateController();

        // Act
        var result = await controller.ExportDriverEmailsCsv(new PaginatedRequest());

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal(fileName, fileResult.FileDownloadName);
    }

    [Fact]
    public async Task ExportDriverEmailsCsv_ServiceThrows_Returns500()
    {
        // Arrange
        _courierReportService.GenerateDriverEmailsCsvAsync(Arg.Any<PaginatedRequest>())
            .ThrowsAsync(new Exception("Export failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ExportDriverEmailsCsv(new PaginatedRequest());

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task ExportDriverEarningsCsv_Success_ReturnsFileResult()
    {
        // Arrange
        var csvBytes = "Name,Earnings\nJohn,250.75"u8.ToArray();
        const string fileName = "driver-earnings-2026-02-18-1430.csv";

        _courierReportService.GenerateDriverEarningsCsvAsync(Arg.Any<PaginatedRequest>()).Returns((csvBytes, fileName));

        var controller = CreateController();

        // Act
        var result = await controller.ExportDriverEarningsCsv(new PaginatedRequest());

        // Assert
        Assert.IsType<FileContentResult>(result);
        var fileResult = (FileContentResult)result;
        Assert.Equal("text/csv", fileResult.ContentType);
        Assert.Equal(fileName, fileResult.FileDownloadName);
    }

    [Fact]
    public async Task ExportDriverEarningsCsv_ServiceThrows_Returns500()
    {
        // Arrange
        _courierReportService.GenerateDriverEarningsCsvAsync(Arg.Any<PaginatedRequest>())
            .ThrowsAsync(new Exception("Export failed"));

        var controller = CreateController();

        // Act
        var result = await controller.ExportDriverEarningsCsv(new PaginatedRequest());

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task ExportTodayActiveDriversCsv_PassesRequestToService()
    {
        // Arrange
        var request = new TodayActiveDriversFilterRequest { SearchTerm = "test", Status = "active" };
        var csvBytes = Array.Empty<byte>();

        _courierReportService.GenerateTodayActiveDriversCsvAsync(request).Returns((csvBytes, "test.csv"));

        var controller = CreateController();

        // Act
        await controller.ExportTodayActiveDriversCsv(request);

        // Assert
        await _courierReportService
            .Received(1).GenerateTodayActiveDriversCsvAsync(request);
    }

    [Fact]
    public async Task GetAllCourierEmails_ValidRequest_ReturnsJsonResult()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10 };
        var expectedResponse = new PaginatedResponse<CourierEmailViewModel>
        {
            Items = new List<CourierEmailViewModel>
            {
                new() { CourierId = 1, Code = "C01", Name = "Alice", Email = "a@test.com" }
            },
            Total = 1, Page = 1, Pages = 1
        };

        _courierRepository.GetCourierEmailsAsync(request).Returns(expectedResponse);

        var controller = CreateController();

        // Act
        var result = await controller.GetAllCourierEmails(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedResponse, jsonResult.Value);
    }

    [Fact]
    public async Task GetAllCourierEmails_NullRequest_Returns500()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetAllCourierEmails(null!);

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetAllCourierEmails_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10 };
        _courierRepository.GetCourierEmailsAsync(request)
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetAllCourierEmails(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetAllCourierEmails_PassesOrderByToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "code" };
        _courierRepository.GetCourierEmailsAsync(Arg.Any<PaginatedRequest>())
            .Returns(new PaginatedResponse<CourierEmailViewModel>());

        var controller = CreateController();

        // Act
        await controller.GetAllCourierEmails(request);

        // Assert
        await _courierRepository
            .Received(1)
            .GetCourierEmailsAsync(Arg.Is<PaginatedRequest>(r => r.OrderBy == "code"));
    }

    [Fact]
    public async Task GetAllCourierEmails_PassesSortDescendingToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "name", SortDescending = true };
        _courierRepository.GetCourierEmailsAsync(Arg.Any<PaginatedRequest>())
            .Returns(new PaginatedResponse<CourierEmailViewModel>());

        var controller = CreateController();

        // Act
        await controller.GetAllCourierEmails(request);

        // Assert
        await _courierRepository
            .Received(1)
            .GetCourierEmailsAsync(Arg.Is<PaginatedRequest>(r => r.SortDescending == true));
    }

    [Fact]
    public async Task GetCourierDailyEarnings_ValidRequest_ReturnsJsonResult()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10 };
        var expectedResponse = new CourierDailyEarningsPaginatedResponse
        {
            Items = new List<CourierDailyEarningsViewModel>
            {
                new() { CourierId = 1, Name = "Alice", Deliveries = 5, Earnings = 100m }
            },
            Total = 1, Page = 1, Pages = 1,
            TotalEarningsToday = 100m, AverageHourlyRate = 25m,
            TotalActiveDrivers = 1, TotalDeliveriesToday = 5
        };

        _courierRepository.GetCourierDailyEarningsAsync(request).Returns(expectedResponse);

        var controller = CreateController();

        // Act
        var result = await controller.GetCourierDailyEarnings(request);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        Assert.Equal(expectedResponse, jsonResult.Value);
    }

    [Fact]
    public async Task GetCourierDailyEarnings_NullRequest_Returns500()
    {
        // Arrange
        var controller = CreateController();

        // Act
        var result = await controller.GetCourierDailyEarnings(null!);

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetCourierDailyEarnings_RepositoryThrows_Returns500()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10 };
        _courierRepository.GetCourierDailyEarningsAsync(request)
            .ThrowsAsync(new Exception("Database error"));

        var controller = CreateController();

        // Act
        var result = await controller.GetCourierDailyEarnings(request);

        // Assert
        Assert.IsType<ObjectResult>(result);
        Assert.Equal(500, ((ObjectResult)result).StatusCode);
    }

    [Fact]
    public async Task GetCourierDailyEarnings_PassesOrderByToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "earnings" };
        _courierRepository.GetCourierDailyEarningsAsync(Arg.Any<PaginatedRequest>())
            .Returns(new CourierDailyEarningsPaginatedResponse());

        var controller = CreateController();

        // Act
        await controller.GetCourierDailyEarnings(request);

        // Assert
        await _courierRepository
            .Received(1)
            .GetCourierDailyEarningsAsync(Arg.Is<PaginatedRequest>(r => r.OrderBy == "earnings"));
    }

    [Fact]
    public async Task GetCourierDailyEarnings_PassesSortDescendingToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "hourlyrate", SortDescending = true };
        _courierRepository.GetCourierDailyEarningsAsync(Arg.Any<PaginatedRequest>())
            .Returns(new CourierDailyEarningsPaginatedResponse());

        var controller = CreateController();

        // Act
        await controller.GetCourierDailyEarnings(request);

        // Assert
        await _courierRepository
            .Received(1)
            .GetCourierDailyEarningsAsync(Arg.Is<PaginatedRequest>(r => r.SortDescending == true));
    }
}