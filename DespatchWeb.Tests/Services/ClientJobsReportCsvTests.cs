using System.Globalization;
using System.Text;
using Amazon.S3;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using DespatchWeb.Services;
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
        Assert.Contains("Raw Base Amount", csvContent);
        Assert.Contains("150.50", csvContent);
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
        Assert.Contains("Fuel Surcharge Amount", csvContent);
        Assert.Contains("25.75", csvContent);
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
        Assert.Contains("100", csvContent);
        Assert.Contains("15", csvContent);
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
        Assert.NotEmpty(result.FileBytes);
        var csvContent = Encoding.UTF8.GetString(result.FileBytes);
        var lines = csvContent.Split('\n', StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length); // Header + 1 data row
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
        Assert.Contains("Raw Base Amount", headerLine);
        Assert.Contains("Fuel Surcharge Amount", headerLine);
        Assert.Contains("Charge Excl GST", headerLine);
    }

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
        Assert.Contains("POD Name", csvContent);
        Assert.Contains("John Smith", csvContent);
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
        Assert.Contains("Type", csvContent);
        Assert.Contains("Pick up from us", csvContent);
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
        Assert.Contains("Charge Excl GST", csvContent);
        Assert.Contains("250.00", csvContent);
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
        Assert.Contains("Test_Company_Ltd", result.FileName);
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
        Assert.Contains("From Address", csvContent);
        Assert.Contains("123 Pickup Street", csvContent);
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
        Assert.Contains("Courier Name", csvContent);
        Assert.Contains("Express Courier", csvContent);
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
        Assert.Contains("Account No.", csvContent);
        Assert.Contains("12345", csvContent);
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
        Assert.Contains("Client Notes", csvContent);
        Assert.Contains("Important client note", csvContent);
    }

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

        Assert.True(rawBaseIndex > -1, "Raw Base Amount column should exist");
        Assert.True(fuelSurchargeIndex > -1, "Fuel Surcharge Amount column should exist");
        Assert.True(chargeExclGstIndex > -1, "Charge Excl GST column should exist");

        // Raw Base Amount should come before Fuel Surcharge Amount
        Assert.True(rawBaseIndex < fuelSurchargeIndex);
        // Fuel Surcharge Amount should come before Charge Excl GST
        Assert.True(fuelSurchargeIndex < chargeExclGstIndex);
    }

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
        Assert.Equal(2, lines.Length); // Header + 1 data row

        var dataLine = lines[1];
        Assert.Contains("JOB-001", dataLine);
        Assert.Contains("15-Jan-24", dataLine);
        Assert.Contains("09:30", dataLine);
        Assert.Contains("100", dataLine);
        Assert.Contains("15", dataLine);
        Assert.Contains("115.00", dataLine);
        Assert.Contains("John Doe", dataLine);
        Assert.Contains("Fast Courier", dataLine);
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
        Assert.Contains(amount.ToString(CultureInfo.InvariantCulture), csvContent);
    }

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

}
