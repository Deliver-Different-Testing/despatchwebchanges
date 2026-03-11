using System.Globalization;
using System.Text;
using Amazon.S3;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
using FluentAssertions;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for Client Jobs Report CSV generation in JobReportService.
/// Covers the mapping of PerformanceSpendReportModel fields to CSV output.
/// </summary>
public class ClientJobsReportCsvTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();
    private readonly Mock<IAmazonS3> _s3ClientMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private JobReportService CreateService() =>
        new(
            _jobRepositoryMock.Object,
            _recurringJobRepositoryMock.Object,
            _clock,
            _s3ClientMock.Object
        );

    #region RawBaseAmount and FuelSurchargeAmount Tests

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithRawBaseAmount_IncludesValueInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(rawBaseAmount: 150.50m)
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Raw Base Amount");
        csvContent.Should().Contain("150.50");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithFuelSurchargeAmount_IncludesValueInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(fuelSurchargeAmount: 25.75m)
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Fuel Surcharge Amount");
        csvContent.Should().Contain("25.75");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithBothAmountFields_IncludesBothValuesInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(rawBaseAmount: 100.00m, fuelSurchargeAmount: 15.00m)
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("100");
        csvContent.Should().Contain("15");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithNullAmountFields_OutputsEmptyValues()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(rawBaseAmount: null, fuelSurchargeAmount: null)
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        result.FileBytes.Should().NotBeEmpty();
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(2); // Header + 1 data row
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_CsvHeader_ContainsAmountColumns()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var headerLine = csvContent.Split('\n')[0];
        headerLine.Should().Contain("Raw Base Amount");
        headerLine.Should().Contain("Fuel Surcharge Amount");
        headerLine.Should().Contain("Charge Excl GST");
    }

    #endregion

    #region Property Mapping Tests (PascalCase Names)

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithPodName_IncludesValueInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(podName: "John Smith")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("POD Name");
        csvContent.Should().Contain("John Smith");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUcjbType_IncludesValueInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(ucjbType: "Pick up from us")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Type");
        csvContent.Should().Contain("Pick up from us");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithChargeExclGst_IncludesValueInCsv()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(chargeExclGst: "250.00")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Charge Excl GST");
        csvContent.Should().Contain("250.00");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUcclLegalName_UsesForFilename()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(ucclLegalName: "Test Company Ltd")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        result.FileName.Should().Contain("Test_Company_Ltd");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUcjbFromAddr_IncludesInFromAddressColumn()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(ucjbFromAddr: "123 Pickup Street")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("From Address");
        csvContent.Should().Contain("123 Pickup Street");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUccrName_IncludesInCourierNameColumn()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(uccrName: "Express Courier")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Courier Name");
        csvContent.Should().Contain("Express Courier");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUcjbClientId_IncludesInAccountNoColumn()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(ucjbClientId: "12345")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Account No.");
        csvContent.Should().Contain("12345");
    }

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithUcclNote_IncludesInClientNotesColumn()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(ucclNote: "Important client note")
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain("Client Notes");
        csvContent.Should().Contain("Important client note");
    }

    #endregion

    #region CSV Column Order Tests

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_CsvHeader_HasCorrectColumnOrder()
    {
        // Arrange
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync([]);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var headerLine = csvContent.Split('\n')[0];
        var columns = headerLine.Split(',');

        // Verify key columns exist and check relative order of amount columns
        var rawBaseIndex = Array.FindIndex(columns, c => c.Contains("Raw Base Amount"));
        var fuelSurchargeIndex = Array.FindIndex(columns, c => c.Contains("Fuel Surcharge Amount"));
        var chargeExclGstIndex = Array.FindIndex(columns, c => c.Contains("Charge Excl GST"));

        rawBaseIndex.Should().BeGreaterThan(-1, "Raw Base Amount column should exist");
        fuelSurchargeIndex.Should().BeGreaterThan(-1, "Fuel Surcharge Amount column should exist");
        chargeExclGstIndex.Should().BeGreaterThan(-1, "Charge Excl GST column should exist");

        // Raw Base Amount should come before Fuel Surcharge Amount
        rawBaseIndex.Should().BeLessThan(fuelSurchargeIndex);
        // Fuel Surcharge Amount should come before Charge Excl GST
        fuelSurchargeIndex.Should().BeLessThan(chargeExclGstIndex);
    }

    #endregion

    #region Integration Tests

    [Fact]
    public async Task GenerateClientJobsReportCsvAsync_WithCompleteModel_GeneratesValidCsvRow()
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            new()
            {
                JobNumber = "JOB-001",
                Date = "15-Jan-24",
                Booked = "09:30",
                BookedBy = "User1",
                Booker = "User1",
                RefA = "REF-A",
                RefB = "REF-B",
                UrgentRef = "URG-001",
                RawBaseAmount = 100.00m,
                FuelSurchargeAmount = 15.00m,
                ChargeExclGst = "115.00",
                From = "Auckland",
                FromPostcode = "1010",
                UcjbFromAddr = "123 Queen St",
                To = "Wellington",
                ToPostcode = "6011",
                Address = "456 Lambton Quay",
                PickedUpTime = "2024-01-15 10:00:00",
                Delivered = "2024-01-15 14:00:00",
                TotalTime = "240",
                PodName = "John Doe",
                AchievedSpeed = "4 Hour",
                Notes = "Test note",
                Quantity = "2",
                Weight = "5.5",
                Vehicle = "Van",
                UcjbType = "3rd party",
                UcjbMonth = "1",
                UcjbYear = "2024",
                Code = "C001",
                UccrName = "Fast Courier",
                UcjbInvoiceNo = "INV-001",
                UcjbClientId = "CLI-001",
                UcclLegalName = "Test Company",
                UcclNote = "Client note"
            }
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        lines.Length.Should().Be(2); // Header + 1 data row

        var dataLine = lines[1];
        dataLine.Should().Contain("JOB-001");
        dataLine.Should().Contain("15-Jan-24");
        dataLine.Should().Contain("09:30");
        dataLine.Should().Contain("100");
        dataLine.Should().Contain("15");
        dataLine.Should().Contain("115.00");
        dataLine.Should().Contain("John Doe");
        dataLine.Should().Contain("Fast Courier");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(99.99)]
    [InlineData(1000.50)]
    [InlineData(12345.67)]
    public async Task GenerateClientJobsReportCsvAsync_WithVariousDecimalValues_FormatsCorrectly(decimal amount)
    {
        // Arrange
        var reports = new List<PerformanceSpendReportModel>
        {
            CreateTestModel(rawBaseAmount: amount)
        };
        _jobRepositoryMock.Setup(x => x.GetClientJobsReportDataAsync(It.IsAny<ClientJobsReportRequest>()))
            .ReturnsAsync(reports);

        var service = CreateService();
        var request = CreateTestRequest();

        // Act
        var result = await service.GenerateClientJobsReportCsvAsync(request);

        // Assert
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        csvContent.Should().Contain(amount.ToString(CultureInfo.InvariantCulture));
    }

    #endregion

    #region Helper Methods

    private static ClientJobsReportRequest CreateTestRequest()
    {
        return new ClientJobsReportRequest
        {
            StartDate = TestDates.Now.AddMonths(-1),
            EndDate = TestDates.Now,
            ClientIds = [1]
        };
    }

    private static PerformanceSpendReportModel CreateTestModel(
        decimal? rawBaseAmount = null,
        decimal? fuelSurchargeAmount = null,
        string? podName = null,
        string? ucjbType = null,
        string? chargeExclGst = null,
        string? ucclLegalName = null,
        string? ucjbFromAddr = null,
        string? uccrName = null,
        string? ucjbClientId = null,
        string? ucclNote = null)
    {
        return new PerformanceSpendReportModel
        {
            JobNumber = "TEST-001",
            Date = "01-Jan-24",
            Booked = "10:00",
            BookedBy = "TestUser",
            Booker = "TestUser",
            RefA = "REF-A",
            RefB = "REF-B",
            UrgentRef = "URG-001",
            RawBaseAmount = rawBaseAmount,
            FuelSurchargeAmount = fuelSurchargeAmount,
            ChargeExclGst = chargeExclGst ?? "100.00",
            From = "Test Suburb",
            FromPostcode = "1234",
            UcjbFromAddr = ucjbFromAddr ?? "Test Address",
            To = "Dest Suburb",
            ToPostcode = "5678",
            Address = "Dest Address",
            PickedUpTime = "2024-01-01 10:30:00",
            Delivered = "2024-01-01 12:00:00",
            TotalTime = "90",
            PodName = podName,
            AchievedSpeed = "2 Hour",
            Notes = "Test notes",
            Quantity = "1",
            Weight = "2.5",
            Vehicle = "Car",
            UcjbType = ucjbType ?? "3rd party",
            UcjbMonth = "1",
            UcjbYear = "2024",
            Code = "C001",
            UccrName = uccrName ?? "Test Courier",
            UcjbInvoiceNo = "INV-001",
            UcjbClientId = ucjbClientId ?? "CLI-001",
            UcclLegalName = ucclLegalName ?? "Test Client Ltd",
            UcclNote = ucclNote
        };
    }

    #endregion
}
