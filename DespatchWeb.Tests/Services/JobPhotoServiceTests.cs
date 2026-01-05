using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Services;
using FluentAssertions;
using Microsoft.AspNetCore.Http;
using Moq;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for JobPhotoService - tests S3 storage operations for job photos and attachments.
/// </summary>
public class JobPhotoServiceTests
{
    private readonly Mock<IAmazonS3> _s3ClientMock = new();

    private JobPhotoService CreateService() => new(_s3ClientMock.Object);

    #region UploadJobPhotoOrSignatureAsync Tests

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_NullFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, null, JobPhotoType.Delivery);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("No file was uploaded");
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_EmptyFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();
        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.Length).Returns(0);

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, fileMock.Object, JobPhotoType.Delivery);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("No file was uploaded");
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_ValidFile_UploadsToS3()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("test.jpg", "image/jpeg", 100);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery);

        // Assert
        result.Success.Should().BeTrue();
        result.FileName.Should().Contain(".jpg");
        result.S3Key.Should().Contain("DeliveryPhotos");
        _s3ClientMock.Verify(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None), Times.Once);
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_SignatureFile_UploadsToSignatureFolder()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("signature.png", "image/png", 50);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery, isPod: false);

        // Assert
        result.Success.Should().BeTrue();
        result.S3Key.Should().Contain("DeliverySignatures");
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_PickupPhoto_UploadsToPickupFolder()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("pickup.jpg", "image/jpeg", 100);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Pickup);

        // Assert
        result.Success.Should().BeTrue();
        result.S3Key.Should().Contain("PickupPhotos");
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_S3Error_ReturnsFailure()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("test.jpg", "image/jpeg", 100);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ThrowsAsync(new AmazonS3Exception("S3 Error"));

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Contain("S3 Error");
    }

    #endregion

    #region DeleteJobPhotoOrSignatureAsync Tests

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteJobPhotoOrSignatureAsync_EmptyKey_ReturnsFalse(string key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, key);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteJobPhotoOrSignatureAsync_ValidKey_DeletesFromS3()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.Setup(x => x.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new DeleteObjectResponse());

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, "DeliveryPhotos/2024/01/1-test.jpg");

        // Assert
        result.Should().BeTrue();
        _s3ClientMock.Verify(x => x.DeleteObjectAsync(
            It.Is<DeleteObjectRequest>(r => r.Key == "DeliveryPhotos/2024/01/1-test.jpg"),
            CancellationToken.None), Times.Once);
    }

    [Fact]
    public async Task DeleteJobPhotoOrSignatureAsync_S3Error_ReturnsFalse()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.Setup(x => x.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), CancellationToken.None))
            .ThrowsAsync(new AmazonS3Exception("Delete failed"));

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, "test-key");

        // Assert
        result.Should().BeFalse();
    }

    #endregion

    #region UploadJobAttachmentAsync Tests

    [Fact]
    public async Task UploadJobAttachmentAsync_NullFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.UploadJobAttachmentAsync(1, null);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("No file uploaded");
    }

    [Fact]
    public async Task UploadJobAttachmentAsync_InvalidFileType_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();
        var file = CreateMockFile("malicious.exe", "application/x-msdownload", 100);

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Contain("Invalid file type");
    }

    [Fact]
    public async Task UploadJobAttachmentAsync_FileTooLarge_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();
        var file = CreateMockFile("large.pdf", "application/pdf", 11 * 1024 * 1024); // 11MB

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Contain("File size exceeds");
    }

    [Fact]
    public async Task UploadJobAttachmentAsync_ValidPdf_Uploads()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("document.pdf", "application/pdf", 1024);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        result.Success.Should().BeTrue();
        result.S3Key.Should().Contain("JobAttachments");
    }

    [Theory]
    [InlineData("image/jpeg")]
    [InlineData("image/png")]
    [InlineData("image/gif")]
    [InlineData("application/pdf")]
    public async Task UploadJobAttachmentAsync_AllowedFileTypes_Uploads(string contentType)
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var extension = contentType switch
        {
            "image/jpeg" => ".jpg",
            "image/png" => ".png",
            "image/gif" => ".gif",
            "application/pdf" => ".pdf",
            _ => ".bin"
        };
        var file = CreateMockFile($"test{extension}", contentType, 100);

        _s3ClientMock.Setup(x => x.PutObjectAsync(It.IsAny<PutObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new PutObjectResponse());

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        result.Success.Should().BeTrue();
    }

    #endregion

    #region DownloadFileAsync Tests

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DownloadFileAsync_EmptyKey_ReturnsFailure(string key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DownloadFileAsync(key);

        // Assert
        result.Success.Should().BeFalse();
        result.ErrorMessage.Should().Be("File key is required");
    }

    #endregion

    #region DeleteFileAsync Tests

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteFileAsync_EmptyKey_ReturnsFalse(string key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DeleteFileAsync(key);

        // Assert
        result.Should().BeFalse();
    }

    [Fact]
    public async Task DeleteFileAsync_ValidKey_DeletesFile()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.Setup(x => x.DeleteObjectAsync(It.IsAny<DeleteObjectRequest>(), CancellationToken.None))
            .ReturnsAsync(new DeleteObjectResponse());

        // Act
        var result = await service.DeleteFileAsync("JobAttachments/1-test.pdf");

        // Assert
        result.Should().BeTrue();
    }

    #endregion

    #region GetDeliveryPhotosAsync Tests

    [Fact]
    public async Task GetDeliveryPhotosAsync_NoPhotos_ReturnsEmptyList()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.Setup(x => x.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), CancellationToken.None))
            .ReturnsAsync(new ListObjectsV2Response { S3Objects = new List<S3Object>() });

        // Act
        var result = await service.GetDeliveryPhotosAsync(1, 2024, 1);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region GetPickupPhotosAsync Tests

    [Fact]
    public async Task GetPickupPhotosAsync_NoPhotos_ReturnsEmptyList()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.Setup(x => x.ListObjectsV2Async(It.IsAny<ListObjectsV2Request>(), CancellationToken.None))
            .ReturnsAsync(new ListObjectsV2Response { S3Objects = new List<S3Object>() });

        // Act
        var result = await service.GetPickupPhotosAsync(1, 2024, 1);

        // Assert
        result.Should().BeEmpty();
    }

    #endregion

    #region Helper Methods

    private static IFormFile CreateMockFile(string fileName, string contentType, long size)
    {
        var content = new byte[size];
        var stream = new MemoryStream(content);

        var fileMock = new Mock<IFormFile>();
        fileMock.Setup(f => f.FileName).Returns(fileName);
        fileMock.Setup(f => f.ContentType).Returns(contentType);
        fileMock.Setup(f => f.Length).Returns(size);
        fileMock.Setup(f => f.OpenReadStream()).Returns(stream);
        fileMock.Setup(f => f.CopyToAsync(It.IsAny<Stream>(), CancellationToken.None))
            .Callback<Stream, CancellationToken>((s, _) =>
            {
                stream.Position = 0;
                stream.CopyTo(s);
            })
            .Returns(Task.CompletedTask);

        return fileMock.Object;
    }

    #endregion
}
