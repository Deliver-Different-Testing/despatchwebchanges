using DespatchWeb.Controllers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Mvc;
using Moq;

namespace DespatchWeb.Tests.Controllers;

/// <summary>
/// Unit tests for CourierController - tests courier-related endpoints.
/// </summary>
public class CourierControllerTests
{

    [Fact]
    public async Task AllActiveSearch_MultipleCouriersReturned_ReturnsAllInCorrectOrder()
    {
        // Arrange
        const string searchTerm = "courier";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (Courier Alpha)" },
            new() { Id = 2, Text = "002 (Courier Beta)" },
            new() { Id = 3, Text = "003 (Courier Charlie)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        if (jsonResult.Value is List<Suggestion> couriers)
        {
            Assert.Equal(3, couriers.Count);
            Assert.Contains("Alpha", couriers[0].Text);
            Assert.Contains("Beta", couriers[1].Text);
            Assert.Contains("Charlie", couriers[2].Text);
        }
    }

    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<ITaskRepository> _taskRepositoryMock = new();
    private readonly Mock<ICourierReportService> _courierReportServiceMock = new();

    private CourierController CreateController()
    {
        return new CourierController(
            _courierRepositoryMock.Object,
            _tenantInfoServiceMock.Object,
            _taskRepositoryMock.Object,
            _courierReportServiceMock.Object);
    }

    [Fact]
    public async Task AllActiveSearch_ValidSearchTerm_ReturnsCouriers()
    {
        // Arrange
        const string searchTerm = "john";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (John Doe)" },
            new() { Id = 2, Text = "002 (Johnny Smith)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var couriers = jsonResult.Value as List<Suggestion>;
        Assert.NotNull(couriers);
        Assert.Equal(2, couriers.Count);
    }

    [Fact]
    public async Task AllActiveSearch_DgOnlyTrue_PassesDgOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (DG Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, true, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, true, false), Times.Once);
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyTrue_PassesLoggedInOnlyToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (Logged In Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, true), Times.Once);
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task AllActiveSearch_BothDgOnlyAndLoggedInOnlyTrue_PassesBothToRepository()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>
        {
            new() { Id = 1, Text = "001 (DG Logged In Courier)" }
        };

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, true, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: true, loggedInOnly: true);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, true, true), Times.Once);
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task AllActiveSearch_DefaultParameters_BothFlagsAreFalse()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>();
        if (expectedCouriers == null) throw new ArgumentNullException(nameof(expectedCouriers));

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert - Verify default values are false
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, false), Times.Once);
    }

    [Fact]
    public async Task AllActiveSearch_LoggedInOnlyReturnsEmpty_ReturnsEmptyList()
    {
        // Arrange
        const string searchTerm = "test";
        var expectedCouriers = new List<Suggestion>(); // Empty - no logged in couriers
        if (expectedCouriers == null) throw new ArgumentNullException(nameof(expectedCouriers));

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, true))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        var result = await controller.AllActiveSearch(searchTerm, dgOnly: false, loggedInOnly: true);

        // Assert
        Assert.IsType<JsonResult>(result);
        var jsonResult = (JsonResult)result;
        var couriers = jsonResult.Value as List<Suggestion>;
        Assert.NotNull(couriers);
        Assert.Empty(couriers);
    }

    [Fact]
    public async Task AllActiveSearch_RepositoryThrowsException_Returns500()
    {
        // Arrange
        const string searchTerm = "test";

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
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
        var expectedCouriers = new List<Suggestion>();
        if (expectedCouriers == null) throw new ArgumentNullException(nameof(expectedCouriers));

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm, false, false), Times.Once);
    }

    [Fact]
    public async Task AllActiveSearch_NullSearchTerm_StillCallsRepository()
    {
        // Arrange
        string? searchTerm = null;
        var expectedCouriers = new List<Suggestion>();
        if (expectedCouriers == null) throw new ArgumentNullException(nameof(expectedCouriers));

        _courierRepositoryMock.Setup(x => x.AllActiveCouriersAsync(searchTerm!, false, false))
            .ReturnsAsync(expectedCouriers);

        var controller = CreateController();

        // Act
        await controller.AllActiveSearch(searchTerm!);

        // Assert
        _courierRepositoryMock.Verify(x => x.AllActiveCouriersAsync(searchTerm!, false, false), Times.Once);
    }

    [Fact]
    public async Task Index_WithNoDates_PassesNullDatesToRepository()
    {
        // Arrange
        var despatchViewIds = new List<int> { 1, 2 };
        var expectedResult = new ClearListViewModel();

        _courierRepositoryMock.Setup(x => x.GetClearListsAsync(despatchViewIds, null, null))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(despatchViewIds);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetClearListsAsync(despatchViewIds, null, null), Times.Once);
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

        _courierRepositoryMock.Setup(x => x.GetClearListsAsync(despatchViewIds, startDate, endDate))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(despatchViewIds, startDate, endDate);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetClearListsAsync(despatchViewIds, startDate, endDate), Times.Once);
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Index_WithNullDespatchViewIds_DefaultsToFallbackId()
    {
        // Arrange
        var expectedResult = new ClearListViewModel();
        var defaultIds = new List<int> { 49 };

        _courierRepositoryMock.Setup(x => x.GetClearListsAsync(defaultIds, null, null))
            .ReturnsAsync(expectedResult);

        var controller = CreateController();

        // Act
        var result = await controller.Index(null!);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetClearListsAsync(defaultIds, null, null), Times.Once);
        Assert.IsType<JsonResult>(result);
    }

    [Fact]
    public async Task Index_RepositoryThrowsException_Returns500()
    {
        // Arrange
        var despatchViewIds = new List<int> { 1 };

        _courierRepositoryMock.Setup(x => x.GetClearListsAsync(despatchViewIds, null, null))
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

        _courierReportServiceMock
            .Setup(x => x.GenerateTodayActiveDriversCsvAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
            .ReturnsAsync((csvBytes, fileName));

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
        _courierReportServiceMock
            .Setup(x => x.GenerateTodayActiveDriversCsvAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
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

        _courierReportServiceMock.Setup(x => x.GenerateComplianceCsvAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync((csvBytes, fileName));

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
        _courierReportServiceMock.Setup(x => x.GenerateComplianceCsvAsync(It.IsAny<CourierComplianceFilterRequest>()))
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
        var fileName = "after-hours-schedule-2026-02-18-1430.csv";

        _courierReportServiceMock
            .Setup(x => x.GenerateAfterHoursScheduleCsvAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ReturnsAsync((csvBytes, fileName));

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
        _courierReportServiceMock
            .Setup(x => x.GenerateAfterHoursScheduleCsvAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
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

        _courierReportServiceMock.Setup(x => x.GenerateDriverEmailsCsvAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync((csvBytes, fileName));

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
        _courierReportServiceMock.Setup(x => x.GenerateDriverEmailsCsvAsync(It.IsAny<PaginatedRequest>()))
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

        _courierReportServiceMock.Setup(x => x.GenerateDriverEarningsCsvAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync((csvBytes, fileName));

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
        _courierReportServiceMock.Setup(x => x.GenerateDriverEarningsCsvAsync(It.IsAny<PaginatedRequest>()))
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

        _courierReportServiceMock.Setup(x => x.GenerateTodayActiveDriversCsvAsync(request))
            .ReturnsAsync((csvBytes, "test.csv"));

        var controller = CreateController();

        // Act
        await controller.ExportTodayActiveDriversCsv(request);

        // Assert
        _courierReportServiceMock.Verify(x => x.GenerateTodayActiveDriversCsvAsync(request), Times.Once);
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

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsAsync(request))
            .ReturnsAsync(expectedResponse);

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
        _courierRepositoryMock.Setup(x => x.GetCourierEmailsAsync(request))
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
        _courierRepositoryMock.Setup(x => x.GetCourierEmailsAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(new PaginatedResponse<CourierEmailViewModel>());

        var controller = CreateController();

        // Act
        await controller.GetAllCourierEmails(request);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetCourierEmailsAsync(It.Is<PaginatedRequest>(r => r.OrderBy == "code")),
            Times.Once);
    }

    [Fact]
    public async Task GetAllCourierEmails_PassesSortDescendingToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "name", SortDescending = true };
        _courierRepositoryMock.Setup(x => x.GetCourierEmailsAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(new PaginatedResponse<CourierEmailViewModel>());

        var controller = CreateController();

        // Act
        await controller.GetAllCourierEmails(request);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetCourierEmailsAsync(It.Is<PaginatedRequest>(r => r.SortDescending == true)),
            Times.Once);
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

        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsAsync(request))
            .ReturnsAsync(expectedResponse);

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
        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsAsync(request))
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
        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(new CourierDailyEarningsPaginatedResponse());

        var controller = CreateController();

        // Act
        await controller.GetCourierDailyEarnings(request);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetCourierDailyEarningsAsync(It.Is<PaginatedRequest>(r => r.OrderBy == "earnings")),
            Times.Once);
    }

    [Fact]
    public async Task GetCourierDailyEarnings_PassesSortDescendingToRepository()
    {
        // Arrange
        var request = new PaginatedRequest { Page = 1, PageSize = 10, OrderBy = "hourlyrate", SortDescending = true };
        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(new CourierDailyEarningsPaginatedResponse());

        var controller = CreateController();

        // Act
        await controller.GetCourierDailyEarnings(request);

        // Assert
        _courierRepositoryMock.Verify(
            x => x.GetCourierDailyEarningsAsync(It.Is<PaginatedRequest>(r => r.SortDescending == true)),
            Times.Once);
    }

}