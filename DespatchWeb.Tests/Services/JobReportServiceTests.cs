using Amazon.S3;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Tests for JobReportService - file parsing and upload processing for bulk price updates.
/// </summary>
public class JobReportServiceTests
{
    private readonly Mock<IJobRepository> _jobRepositoryMock = new();
    private readonly Mock<IRecurringJobRepository> _recurringJobRepositoryMock = new();
    private readonly FakeTenantClock _clock = new(TestDates.Now);
    private readonly Mock<IAmazonS3> _s3ClientMock = new();

    private JobReportService CreateService() => new(
        _jobRepositoryMock.Object,
        _recurringJobRepositoryMock.Object,
        _clock,
        _s3ClientMock.Object
    );

    [Fact]
    public async Task ParseBulkPriceFileAsync_NullFile_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<JobManualPriceModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Equal("No file provided.", ex.Message);
        return;

        // Act
        Task<IReadOnlyList<JobManualPriceModel>> Act() => service.ParseBulkPriceFileAsync(null!);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_EmptyFileName_ThrowsArgumentException()
    {
        // Arrange
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns(string.Empty);

        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<JobManualPriceModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Equal("No file provided.", ex.Message);
        return;

        // Act
        Task<IReadOnlyList<JobManualPriceModel>> Act() => service.ParseBulkPriceFileAsync(fileMock.Object);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_InvalidExtension_ThrowsArgumentException()
    {
        // Arrange
        var fileMock = CreateMockFile("test.pdf", "invalid content");
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<JobManualPriceModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.StartsWith("Invalid file format", ex.Message);
        return;

        // Act
        Task<IReadOnlyList<JobManualPriceModel>> Act() => service.ParseBulkPriceFileAsync(fileMock.Object);
    }

    [Theory]
    [InlineData("test.txt")]
    [InlineData("test.doc")]
    [InlineData("test.json")]
    [InlineData("test.xml")]
    public async Task ParseBulkPriceFileAsync_UnsupportedExtensions_ThrowsArgumentException(string fileName)
    {
        // Arrange
        var fileMock = CreateMockFile(fileName, "content");
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>((Func<Task<IReadOnlyList<JobManualPriceModel>>>?)Act ?? throw new InvalidOperationException());
        Assert.Equal("Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.", ex.Message);
        return;

        // Act
        Task<IReadOnlyList<JobManualPriceModel>> Act() => service.ParseBulkPriceFileAsync(fileMock.Object);
    }

    [Theory]
    [InlineData("test.csv")]
    [InlineData("test.CSV")]
    [InlineData("test.xls")]
    [InlineData("test.XLS")]
    [InlineData("test.xlsx")]
    [InlineData("test.XLSX")]
    public async Task ParseBulkPriceFileAsync_ValidExtensions_DoesNotThrowValidationError(string fileName)
    {
        // Arrange - create minimal valid CSV
        const string csvContent = "Id,Amount\n1,100";
        var fileMock = CreateMockCsvFile(fileName, csvContent);
        var service = CreateService();

        // Act - may throw parsing error but not validation error
        Exception? caughtException = null;
        try
        {
            await service.ParseBulkPriceFileAsync(fileMock.Object);
        }
        catch (ArgumentException ex) when (ex.Message.Contains("Invalid file format"))
        {
            caughtException = ex;
        }
        catch
        {
            // Other exceptions are OK - means it passed validation
        }

        // Assert
        Assert.Null(caughtException);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_ValidCsv_ParsesCorrectly()
    {
        // Arrange
        const string csvContent = "Id,Amount,Fuel,Ppd\n1,100.50,10.25,5.00\n2,200.00,20.00,10.00";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        Assert.Equal(2, result.Count);

        Assert.Equal(1, result[0].Id);
        Assert.Equal(100.50m, result[0].Amount);
        Assert.Equal(10.25m, result[0].Fuel);
        Assert.Equal(5.00m, result[0].Ppd);

        Assert.Equal(2, result[1].Id);
        Assert.Equal(200.00m, result[1].Amount);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CsvWithEmptyValues_ParsesAsNull()
    {
        // Arrange
        const string csvContent = "Id,Amount,Fuel\n1,,10.00\n2,200.00,";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        Assert.Equal(2, result.Count);
        Assert.Null(result[0].Amount);
        Assert.Equal(10.00m, result[0].Fuel);
        Assert.Equal(200.00m, result[1].Amount);
        Assert.Null(result[1].Fuel);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CsvWithAllFields_ParsesAllFields()
    {
        // Arrange
        const string csvContent = "Id,Amount,Fuel,Ppd,CourierPayment,CourierFuel,CourierBonus,StatusName,CourierCode\n" +
                                  "1,100,10,5,50,5,2,Completed,C001";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        Assert.Single(result);
        var row = result[0];
        Assert.Equal(1, row.Id);
        Assert.Equal(100m, row.Amount);
        Assert.Equal(10m, row.Fuel);
        Assert.Equal(5m, row.Ppd);
        Assert.Equal(50m, row.CourierPayment);
        Assert.Equal(5m, row.CourierFuel);
        Assert.Equal(2m, row.CourierBonus);
        Assert.Equal("Completed", row.StatusName);
        Assert.Equal("C001", row.CourierCode);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_EmptyCsv_ReturnsEmptyList()
    {
        // Arrange - header only, no data rows
        const string csvContent = "Id,Amount,Fuel";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CaseInsensitiveHeaders_ParsesCorrectly()
    {
        // Arrange - mixed case headers
        const string csvContent = "ID,AMOUNT,fuel,PPD\n1,100,10,5";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        Assert.Single(result);
        Assert.Equal(1, result[0].Id);
        Assert.Equal(100m, result[0].Amount);
    }

    [Fact]
    public async Task ProcessJobPriceUploadAsync_NullFile_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();

        // Assert
        var ex = await Assert.ThrowsAsync<ArgumentException>(Act);
        Assert.Equal("No file provided.", ex.Message);
        return;

        // Act
        Task Act() => service.ProcessJobPriceUploadAsync(null!);
    }

    [Fact]
    public async Task ProcessJobPriceUploadAsync_ValidFile_ArchivesAndUpdates()
    {
        // Arrange
        const string csvContent = "Id,Amount\n1,100\n2,200";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);

        // Clock is pre-set with TestDates.Now via FakeTenantClock

        var service = CreateService();

        // Act
        await service.ProcessJobPriceUploadAsync(fileMock.Object);

        // Assert - verify S3 upload was called
        _s3ClientMock.Verify(x => x.PutObjectAsync(
            It.IsAny<Amazon.S3.Model.PutObjectRequest>(),
            It.IsAny<CancellationToken>()), Times.Once);

        // Assert - verify repository update was called
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(
            It.Is<IReadOnlyList<JobManualPriceModel>>(l => l.Count == 2)), Times.Once);
    }

    [Fact]
    public async Task ProcessJobPriceUploadAsync_EmptyFile_DoesNotCallUpdate()
    {
        // Arrange
        const string csvContent = "Id,Amount"; // Header only
        var fileMock = CreateMockCsvFile("test.csv", csvContent);

        // Clock is pre-set with TestDates.Now via FakeTenantClock

        var service = CreateService();

        // Act
        await service.ProcessJobPriceUploadAsync(fileMock.Object);

        // Assert - should not call update when no data
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(It.IsAny<IReadOnlyList<JobManualPriceModel>>()), Times.Never);
    }

    private static Mock<IFormFile> CreateMockFile(string fileName, string content)
    {
        var fileMock = new Mock<IFormFile>();
        var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes(content));

        fileMock.Setup(f => f.FileName).Returns(fileName);
        fileMock.Setup(f => f.Length).Returns(stream.Length);
        fileMock.Setup(f => f.OpenReadStream()).Returns(stream);
        fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Returns<Stream, CancellationToken>((s, x) =>
            {
                stream.Position = 0;
                return stream.CopyToAsync(s, x);
            });

        return fileMock;
    }

    private static Mock<IFormFile> CreateMockCsvFile(string fileName, string csvContent)
    {
        var fileMock = new Mock<IFormFile>();
        var bytes = System.Text.Encoding.UTF8.GetBytes(csvContent);

        fileMock.Setup(f => f.FileName).Returns(fileName);
        fileMock.Setup(f => f.Length).Returns(bytes.Length);
        fileMock.Setup(f => f.OpenReadStream()).Returns(() => new MemoryStream(bytes));
        fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), It.IsAny<CancellationToken>()))
            .Returns<Stream, CancellationToken>((s, x) =>
            {
                var ms = new MemoryStream(bytes);
                return ms.CopyToAsync(s, x);
            });

        return fileMock;
    }

}
