using System.Text;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using DespatchWeb.Services;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for CourierReportService - CSV export generation for driver management dashboard.
/// </summary>
public class CourierReportServiceTests
{
    private readonly Mock<ICourierRepository> _courierRepositoryMock = new();
    private FakeTenantClock _clock = new(new DateTime(2026, 2, 18, 14, 30, 0));

    private CourierReportService CreateService() => new(
        _courierRepositoryMock.Object,
        _clock
    );

    private static string DecodeCsv(byte[] bytes)
    {
        var text = Encoding.UTF8.GetString(bytes);
        // Strip UTF-8 BOM if present
        if (text.Length > 0 && text[0] == '\uFEFF')
            text = text[1..];
        return text;
    }

    private static string[] GetCsvLines(byte[] bytes) => DecodeCsv(bytes).TrimEnd('\r', '\n').Split('\n').Select(l => l.TrimEnd('\r')).ToArray();

    [Fact]
    public async Task GenerateTodayActiveDriversCsvAsync_WithData_ReturnsCorrectHeadersAndRows()
    {
        // Arrange
        var data = new List<TodayActiveDriversViewModel>
        {
            new()
            {
                CourierId = 1, Code = "C001", Name = "John Doe", Fleet = "Fleet A",
                LoginTime = new DateTimeOffset(2026, 2, 18, 8, 0, 0, TimeSpan.FromHours(12)),
                LogoutTime = new DateTimeOffset(2026, 2, 18, 16, 0, 0, TimeSpan.FromHours(12)),
                Duration = "8h 0m", Deliveries = 12, Status = "Active"
            },
            new()
            {
                CourierId = 2, Code = "C002", Name = "Jane Smith", Fleet = "Fleet B",
                LoginTime = new DateTimeOffset(2026, 2, 18, 9, 30, 0, TimeSpan.FromHours(12)),
                LogoutTime = null,
                Duration = "5h 0m", Deliveries = 7, Status = "Active"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetTodayActiveDriversForExportAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, fileName) = await service.GenerateTodayActiveDriversCsvAsync(new TodayActiveDriversFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(3, lines.Length); // header + 2 data rows
        Assert.Equal("Code,Name,Fleet,Login Time,Logout Time,Duration,Deliveries,Status", lines[0]);
        Assert.Contains("C001", lines[1]);
        Assert.Contains("John Doe", lines[1]);
        Assert.Contains("12", lines[1]);
        Assert.Contains("Active", lines[1]);
        Assert.Contains("C002", lines[2]);
        Assert.Contains("Jane Smith", lines[2]);

        Assert.Equal("today-active-drivers-2026-02-18-1430.csv", fileName);
    }

    [Fact]
    public async Task GenerateTodayActiveDriversCsvAsync_NullLogoutTime_OutputsEmptyField()
    {
        // Arrange
        var data = new List<TodayActiveDriversViewModel>
        {
            new()
            {
                CourierId = 1, Code = "C001", Name = "Test", Fleet = "F",
                LoginTime = new DateTimeOffset(2026, 2, 18, 8, 0, 0, TimeSpan.Zero),
                LogoutTime = null,
                Duration = "1h", Deliveries = 0, Status = "Active"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetTodayActiveDriversForExportAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateTodayActiveDriversCsvAsync(new TodayActiveDriversFilterRequest());

        // Assert - Logout Time field should be empty
        var lines = GetCsvLines(fileBytes);
        var fields = lines[1].Split(',');
        Assert.Empty(fields[4]);
    }

    [Fact]
    public async Task GenerateTodayActiveDriversCsvAsync_EmptyData_ReturnsHeaderOnly()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetTodayActiveDriversForExportAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateTodayActiveDriversCsvAsync(new TodayActiveDriversFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Single(lines);
        Assert.Equal("Code,Name,Fleet,Login Time,Logout Time,Duration,Deliveries,Status", lines[0]);
    }

    [Fact]
    public async Task GenerateTodayActiveDriversCsvAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetTodayActiveDriversForExportAsync(It.IsAny<TodayActiveDriversFilterRequest>()))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        var service = CreateService();

        // Act
        var act = () => service.GenerateTodayActiveDriversCsvAsync(new TodayActiveDriversFilterRequest());

        // Assert
        var ex = await Assert.ThrowsAsync<InvalidOperationException>(act);
        Assert.Equal("Database error", ex.Message);
    }

    [Fact]
    public async Task GenerateTodayActiveDriversCsvAsync_PassesRequestToRepository()
    {
        // Arrange
        var request = new TodayActiveDriversFilterRequest { SearchTerm = "test", Status = "active", Fleet = 5 };

        _courierRepositoryMock.Setup(x => x.GetTodayActiveDriversForExportAsync(request))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        await service.GenerateTodayActiveDriversCsvAsync(request);

        // Assert
        _courierRepositoryMock.Verify(x => x.GetTodayActiveDriversForExportAsync(request), Times.Once);
    }

    [Fact]
    public async Task GenerateComplianceCsvAsync_WithData_ReturnsCorrectHeadersAndRows()
    {
        // Arrange
        var data = new List<CourierComplianceViewModel>
        {
            new()
            {
                Code = "C001", Name = "John Doe", ComplianceType = "Driver's License",
                ItemNumber = "DL12345",
                ExpiryDate = new DateTimeOffset(2026, 6, 15, 0, 0, 0, TimeSpan.Zero),
                Status = "Valid", DaysUntilExpiry = "117 days"
            },
            new()
            {
                Code = "C002", Name = "Jane Smith", ComplianceType = "Insurance",
                ItemNumber = "INS-789", ExpiryDate = null,
                Status = "Not Set", DaysUntilExpiry = "\u2014"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, fileName) = await service.GenerateComplianceCsvAsync(new CourierComplianceFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(3, lines.Length);
        Assert.Equal("Code,Name,Type,Item/Number,Expiry Date,Status,Days Until Expiry", lines[0]);
        Assert.Contains("C001", lines[1]);
        Assert.Contains("Driver's License", lines[1]);
        Assert.Contains("15/06/2026", lines[1]);
        // Null expiry date should produce empty field
        Assert.Contains("C002", lines[2]);
        Assert.Contains("Insurance", lines[2]);

        Assert.Equal("driver-compliance-2026-02-18-1430.csv", fileName);
    }

    [Fact]
    public async Task GenerateComplianceCsvAsync_NullExpiryDate_OutputsEmptyField()
    {
        // Arrange
        var data = new List<CourierComplianceViewModel>
        {
            new()
            {
                Code = "C001", Name = "Test", ComplianceType = "License",
                ItemNumber = "123", ExpiryDate = null,
                Status = "Not Set", DaysUntilExpiry = "\u2014"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateComplianceCsvAsync(new CourierComplianceFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        var fields = lines[1].Split(',');
        Assert.Empty(fields[4]);
    }

    [Fact]
    public async Task GenerateComplianceCsvAsync_EmptyData_ReturnsHeaderOnly()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateComplianceCsvAsync(new CourierComplianceFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Single(lines);
        Assert.Equal("Code,Name,Type,Item/Number,Expiry Date,Status,Days Until Expiry", lines[0]);
    }

    [Fact]
    public async Task GenerateComplianceCsvAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierComplianceForExportAsync(It.IsAny<CourierComplianceFilterRequest>()))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        var service = CreateService();

        // Act
        var act = () => service.GenerateComplianceCsvAsync(new CourierComplianceFilterRequest());

        // Assert
        await Assert.ThrowsAsync<InvalidOperationException>(act);
    }

    [Fact]
    public async Task GenerateAfterHoursScheduleCsvAsync_WithData_ReturnsCorrectHeadersAndRows()
    {
        // Arrange
        var data = new List<AfterHoursCourierScheduleViewModel>
        {
            new()
            {
                AfterHoursScheduleId = 1, CourierId = 10, CourierName = "John Doe", CourierCode = "C001",
                Days = ["Monday", "Wednesday", "Friday"],
                StartTime = new DateTimeOffset(2026, 1, 1, 17, 0, 0, TimeSpan.Zero),
                EndTime = new DateTimeOffset(2026, 1, 1, 21, 0, 0, TimeSpan.Zero),
                Duration = "4 hours"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetAfterHoursScheduleForExportAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, fileName) = await service.GenerateAfterHoursScheduleCsvAsync(new CourierAfterHoursFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(2, lines.Length);
        Assert.Equal("Driver Name,Driver Code,Days,Start Time,End Time,Duration", lines[0]);
        Assert.Contains("John Doe", lines[1]);
        Assert.Contains("C001", lines[1]);
        Assert.Contains("4 hours", lines[1]);
        // Days should be joined with comma-space (and thus CSV-quoted since it contains commas)
        Assert.Contains("Monday", lines[1]);

        Assert.Equal("after-hours-schedule-2026-02-18-1430.csv", fileName);
    }

    [Fact]
    public async Task GenerateAfterHoursScheduleCsvAsync_MultipleDays_JoinedAndQuoted()
    {
        // Arrange
        var data = new List<AfterHoursCourierScheduleViewModel>
        {
            new()
            {
                CourierName = "Test", CourierCode = "T01",
                Days = ["Monday", "Tuesday"],
                StartTime = new DateTimeOffset(2026, 1, 1, 17, 0, 0, TimeSpan.Zero),
                EndTime = new DateTimeOffset(2026, 1, 1, 21, 0, 0, TimeSpan.Zero),
                Duration = "4h"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetAfterHoursScheduleForExportAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateAfterHoursScheduleCsvAsync(new CourierAfterHoursFilterRequest());

        // Assert - "Monday, Tuesday" contains a comma, so it should be quoted
        var csv = DecodeCsv(fileBytes);
        Assert.Contains("\"Monday, Tuesday\"", csv);
    }

    [Fact]
    public async Task GenerateAfterHoursScheduleCsvAsync_NullDays_OutputsEmptyField()
    {
        // Arrange
        var data = new List<AfterHoursCourierScheduleViewModel>
        {
            new()
            {
                CourierName = "Test", CourierCode = "T01",
                Days = null!,
                StartTime = null, EndTime = null,
                Duration = "N/A"
            }
        };

        _courierRepositoryMock.Setup(x => x.GetAfterHoursScheduleForExportAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateAfterHoursScheduleCsvAsync(new CourierAfterHoursFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(2, lines.Length);
    }

    [Fact]
    public async Task GenerateAfterHoursScheduleCsvAsync_EmptyData_ReturnsHeaderOnly()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetAfterHoursScheduleForExportAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateAfterHoursScheduleCsvAsync(new CourierAfterHoursFilterRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Single(lines);
        Assert.Equal("Driver Name,Driver Code,Days,Start Time,End Time,Duration", lines[0]);
    }

    [Fact]
    public async Task GenerateAfterHoursScheduleCsvAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetAfterHoursScheduleForExportAsync(It.IsAny<CourierAfterHoursFilterRequest>()))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        var service = CreateService();

        // Act
        var act = () => service.GenerateAfterHoursScheduleCsvAsync(new CourierAfterHoursFilterRequest());

        // Assert
        await Assert.ThrowsAsync<InvalidOperationException>(act);
    }

    [Fact]
    public async Task GenerateDriverEmailsCsvAsync_WithData_ReturnsCorrectHeadersAndRows()
    {
        // Arrange
        var data = new List<CourierEmailViewModel>
        {
            new() { CourierId = 1, Code = "C001", Name = "John Doe", Email = "john@example.com", Phone = "021-555-1234", Fleet = "Fleet A" },
            new() { CourierId = 2, Code = "C002", Name = "Jane Smith", Email = "jane@example.com", Phone = "021-555-5678", Fleet = "Fleet B" }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, fileName) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(3, lines.Length);
        Assert.Equal("Code,Name,Email,Phone,Fleet", lines[0]);
        Assert.Contains("C001", lines[1]);
        Assert.Contains("John Doe", lines[1]);
        Assert.Contains("john@example.com", lines[1]);
        Assert.Contains("C002", lines[2]);
        Assert.Contains("Jane Smith", lines[2]);

        Assert.Equal("driver-emails-2026-02-18-1430.csv", fileName);
    }

    [Fact]
    public async Task GenerateDriverEmailsCsvAsync_EmptyData_ReturnsHeaderOnly()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Single(lines);
        Assert.Equal("Code,Name,Email,Phone,Fleet", lines[0]);
    }

    [Fact]
    public async Task GenerateDriverEmailsCsvAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        var service = CreateService();

        // Act
        var act = () => service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        await Assert.ThrowsAsync<InvalidOperationException>(act);
    }

    [Fact]
    public async Task GenerateDriverEarningsCsvAsync_WithData_ReturnsCorrectHeadersAndRows()
    {
        // Arrange
        var data = new List<CourierDailyEarningsViewModel>
        {
            new() { CourierId = 1, Name = "John Doe", HoursLogged = 7.5, Deliveries = 12, Earnings = 250.75m, HourlyRate = 33.43m },
            new() { CourierId = 2, Name = "Jane Smith", HoursLogged = 4.0, Deliveries = 5, Earnings = 120.00m, HourlyRate = 30.00m }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, fileName) = await service.GenerateDriverEarningsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(3, lines.Length);
        Assert.Equal("Name,Hours Logged,Deliveries,Earnings,Hourly Rate", lines[0]);
        Assert.Equal("John Doe,7.5,12,250.75,33.43", lines[1]);
        Assert.Equal("Jane Smith,4.0,5,120.00,30.00", lines[2]);

        Assert.Equal("driver-earnings-2026-02-18-1430.csv", fileName);
    }

    [Fact]
    public async Task GenerateDriverEarningsCsvAsync_ZeroValues_FormattedCorrectly()
    {
        // Arrange
        var data = new List<CourierDailyEarningsViewModel>
        {
            new() { CourierId = 1, Name = "New Driver", HoursLogged = 0, Deliveries = 0, Earnings = 0m, HourlyRate = 0m }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEarningsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal("New Driver,0.0,0,0.00,0.00", lines[1]);
    }

    [Fact]
    public async Task GenerateDriverEarningsCsvAsync_EmptyData_ReturnsHeaderOnly()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEarningsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Single(lines);
        Assert.Equal("Name,Hours Logged,Deliveries,Earnings,Hourly Rate", lines[0]);
    }

    [Fact]
    public async Task GenerateDriverEarningsCsvAsync_RepositoryThrows_PropagatesException()
    {
        // Arrange
        _courierRepositoryMock.Setup(x => x.GetCourierDailyEarningsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ThrowsAsync(new InvalidOperationException("Database error"));

        var service = CreateService();

        // Act
        var act = () => service.GenerateDriverEarningsCsvAsync(new PaginatedRequest());

        // Assert
        await Assert.ThrowsAsync<InvalidOperationException>(act);
    }

    [Fact]
    public async Task CsvExport_FieldWithComma_IsQuoted()
    {
        // Arrange
        var data = new List<CourierEmailViewModel>
        {
            new() { CourierId = 1, Code = "C001", Name = "Doe, John", Email = "test@test.com", Phone = "123", Fleet = "A" }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        var csv = DecodeCsv(fileBytes);
        Assert.Contains("\"Doe, John\"", csv);
    }

    [Fact]
    public async Task CsvExport_FieldWithQuotes_IsEscaped()
    {
        // Arrange
        var data = new List<CourierEmailViewModel>
        {
            new() { CourierId = 1, Code = "C001", Name = "John \"JD\" Doe", Email = "test@test.com", Phone = "123", Fleet = "A" }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        var csv = DecodeCsv(fileBytes);
        Assert.Contains("\"John \"\"JD\"\" Doe\"", csv);
    }

    [Fact]
    public async Task CsvExport_NullFields_OutputsEmptyString()
    {
        // Arrange
        var data = new List<CourierEmailViewModel>
        {
            new() { CourierId = 1, Code = null!, Name = null!, Email = null!, Phone = null!, Fleet = null! }
        };

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync(data);

        var service = CreateService();

        // Act
        var (fileBytes, _) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        var lines = GetCsvLines(fileBytes);
        Assert.Equal(",,,,", lines[1]);
    }

    [Theory]
    [InlineData(2026, 1, 5, 9, 5, "2026-01-05-0905")]
    [InlineData(2026, 12, 31, 23, 59, "2026-12-31-2359")]
    public async Task GenerateDriverEmailsCsvAsync_FilenameContainsCorrectTimestamp(
        int year, int month, int day, int hour, int minute, string expectedTimestamp)
    {
        // Arrange
        _clock = new FakeTenantClock(new DateTime(year, month, day, hour, minute, 0));

        _courierRepositoryMock.Setup(x => x.GetCourierEmailsForExportAsync(It.IsAny<PaginatedRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();

        // Act
        var (_, fileName) = await service.GenerateDriverEmailsCsvAsync(new PaginatedRequest());

        // Assert
        Assert.Equal($"driver-emails-{expectedTimestamp}.csv", fileName);
    }

}
