using Amazon.S3;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Services;
using FluentAssertions;
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
    private readonly Mock<ITenantInfoService> _tenantInfoServiceMock = new();
    private readonly Mock<IAmazonS3> _s3ClientMock = new();

    private JobReportService CreateService() => new(
        _jobRepositoryMock.Object,
        _recurringJobRepositoryMock.Object,
        _tenantInfoServiceMock.Object,
        _s3ClientMock.Object
    );

    #region ParseBulkPriceFileAsync Validation Tests

    [Fact]
    public async Task ParseBulkPriceFileAsync_NullFile_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = () => service.ParseBulkPriceFileAsync(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("No file provided.");
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_EmptyFileName_ThrowsArgumentException()
    {
        // Arrange
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns(string.Empty);

        var service = CreateService();

        // Act
        var act = () => service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("No file provided.");
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_InvalidExtension_ThrowsArgumentException()
    {
        // Arrange
        var fileMock = CreateMockFile("test.pdf", "invalid content");
        var service = CreateService();

        // Act
        var act = () => service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Invalid file format*");
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

        // Act
        var act = () => service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.");
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
        var csvContent = "Id,Amount\n1,100";
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
        caughtException.Should().BeNull("file extension should be valid");
    }

    #endregion

    #region ParseBulkPriceFileAsync CSV Parsing Tests

    [Fact]
    public async Task ParseBulkPriceFileAsync_ValidCsv_ParsesCorrectly()
    {
        // Arrange
        var csvContent = "Id,Amount,Fuel,Ppd\n1,100.50,10.25,5.00\n2,200.00,20.00,10.00";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        result.Should().HaveCount(2);

        result[0].Id.Should().Be(1);
        result[0].Amount.Should().Be(100.50m);
        result[0].Fuel.Should().Be(10.25m);
        result[0].Ppd.Should().Be(5.00m);

        result[1].Id.Should().Be(2);
        result[1].Amount.Should().Be(200.00m);
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CsvWithEmptyValues_ParsesAsNull()
    {
        // Arrange
        var csvContent = "Id,Amount,Fuel\n1,,10.00\n2,200.00,";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        result.Should().HaveCount(2);
        result[0].Amount.Should().BeNull();
        result[0].Fuel.Should().Be(10.00m);
        result[1].Amount.Should().Be(200.00m);
        result[1].Fuel.Should().BeNull();
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CsvWithAllFields_ParsesAllFields()
    {
        // Arrange
        var csvContent = "Id,Amount,Fuel,Ppd,CourierPayment,CourierFuel,CourierBonus,StatusName,CourierCode\n" +
                         "1,100,10,5,50,5,2,Completed,C001";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        result.Should().HaveCount(1);
        var row = result[0];
        row.Id.Should().Be(1);
        row.Amount.Should().Be(100m);
        row.Fuel.Should().Be(10m);
        row.Ppd.Should().Be(5m);
        row.CourierPayment.Should().Be(50m);
        row.CourierFuel.Should().Be(5m);
        row.CourierBonus.Should().Be(2m);
        row.StatusName.Should().Be("Completed");
        row.CourierCode.Should().Be("C001");
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_EmptyCsv_ReturnsEmptyList()
    {
        // Arrange - header only, no data rows
        var csvContent = "Id,Amount,Fuel";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task ParseBulkPriceFileAsync_CaseInsensitiveHeaders_ParsesCorrectly()
    {
        // Arrange - mixed case headers
        var csvContent = "ID,AMOUNT,fuel,PPD\n1,100,10,5";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);
        var service = CreateService();

        // Act
        var result = await service.ParseBulkPriceFileAsync(fileMock.Object);

        // Assert
        result.Should().HaveCount(1);
        result[0].Id.Should().Be(1);
        result[0].Amount.Should().Be(100m);
    }

    #endregion

    #region ProcessJobPriceUploadAsync Tests

    [Fact]
    public async Task ProcessJobPriceUploadAsync_NullFile_ThrowsArgumentException()
    {
        // Arrange
        var service = CreateService();

        // Act
        var act = () => service.ProcessJobPriceUploadAsync(null!);

        // Assert
        await act.Should().ThrowAsync<ArgumentException>()
            .WithMessage("No file provided.");
    }

    [Fact]
    public async Task ProcessJobPriceUploadAsync_ValidFile_ArchivesAndUpdates()
    {
        // Arrange
        var csvContent = "Id,Amount\n1,100\n2,200";
        var fileMock = CreateMockCsvFile("test.csv", csvContent);

        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(new DateTime(2024, 1, 15, 10, 30, 0));

        var service = CreateService();

        // Act
        await service.ProcessJobPriceUploadAsync(fileMock.Object);

        // Assert - verify S3 upload was called
        _s3ClientMock.Verify(x => x.PutObjectAsync(
            It.IsAny<Amazon.S3.Model.PutObjectRequest>(),
            It.IsAny<CancellationToken>()), Times.Once);

        // Assert - verify repository update was called
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(
            It.Is<List<JobManualPriceModel>>(l => l.Count == 2)), Times.Once);
    }

    [Fact]
    public async Task ProcessJobPriceUploadAsync_EmptyFile_DoesNotCallUpdate()
    {
        // Arrange
        var csvContent = "Id,Amount"; // Header only
        var fileMock = CreateMockCsvFile("test.csv", csvContent);

        _tenantInfoServiceMock.Setup(x => x.GetCurrentTenantTime())
            .Returns(DateTime.Now);

        var service = CreateService();

        // Act
        await service.ProcessJobPriceUploadAsync(fileMock.Object);

        // Assert - should not call update when no data
        _jobRepositoryMock.Verify(x => x.UpdateManualPriceAsync(It.IsAny<List<JobManualPriceModel>>()), Times.Never);
    }

    #endregion

    #region Helper Methods

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

    #endregion
}
