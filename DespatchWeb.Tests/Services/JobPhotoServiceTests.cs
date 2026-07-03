using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Services;
using Microsoft.AspNetCore.Http;
using NSubstitute;
using NSubstitute.ExceptionExtensions;

namespace DespatchWeb.Tests.Services;

/// <summary>
/// Unit tests for JobPhotoService - tests S3 storage operations for job photos and attachments.
/// </summary>
public class JobPhotoServiceTests
{
    private readonly IAmazonS3 _s3ClientMock = Substitute.For<IAmazonS3>();
    private readonly FakeTenantClock _clock = new(TestDates.Now);

    private JobPhotoService CreateService() => new(_s3ClientMock, _clock);

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_NullFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, null, JobPhotoType.Delivery);

        // Assert
        Assert.False(result.Success);
        Assert.Equal("No file was uploaded", result.ErrorMessage);
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_EmptyFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();
        var fileMock = Substitute.For<IFormFile>();
        fileMock.Length.Returns(0);

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, fileMock, JobPhotoType.Delivery);

        // Assert
        Assert.False(result.Success);
        Assert.Equal("No file was uploaded", result.ErrorMessage);
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_ValidFile_UploadsToS3()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("test.jpg", "image/jpeg", 100);

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery);

        // Assert
        Assert.True(result.Success);
        Assert.Contains(".jpg", result.FileName);
        Assert.Matches(@"^DeliveryPhotos/\d{4}/\d{2}/1-\d{14}\.jpg$", result.S3Key);
        await _s3ClientMock.Received().PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_SignatureFile_UploadsToSignatureFolder()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("signature.png", "image/png", 50);

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery, isPod: false);

        // Assert
        Assert.True(result.Success);
        Assert.Matches(@"^DeliverySignatures/\d{4}/\d{2}/1-\d{14}\.png$", result.S3Key);
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_PickupPhoto_UploadsToPickupFolder()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("pickup.jpg", "image/jpeg", 100);

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new PutObjectResponse());

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Pickup);

        // Assert
        Assert.True(result.Success);
        Assert.Matches(@"^PickupPhotos/\d{4}/\d{2}/1-\d{14}\.jpg$", result.S3Key);
    }

    [Fact]
    public async Task UploadJobPhotoOrSignatureAsync_S3Error_ReturnsFailure()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("test.jpg", "image/jpeg", 100);

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>()).ThrowsAsync(new AmazonS3Exception("S3 Error"));

        // Act
        var result = await service.UploadJobPhotoOrSignatureAsync(1, file, JobPhotoType.Delivery);

        // Assert
        Assert.False(result.Success);
        Assert.Contains("S3 Error", result.ErrorMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteJobPhotoOrSignatureAsync_EmptyKey_ReturnsFalse(string? key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, key);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task DeleteJobPhotoOrSignatureAsync_ValidKey_DeletesFromS3()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteObjectResponse());

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, "DeliveryPhotos/2024/01/1-test.jpg");

        // Assert
        Assert.True(result);
        await _s3ClientMock.Received().DeleteObjectAsync(
            Arg.Is<DeleteObjectRequest>(r => r.Key == "DeliveryPhotos/2024/01/1-test.jpg"),
            Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task DeleteJobPhotoOrSignatureAsync_S3Error_ReturnsFalse()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>()).ThrowsAsync(new AmazonS3Exception("Delete failed"));

        // Act
        var result = await service.DeleteJobPhotoOrSignatureAsync(1, "test-key");

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task UploadJobAttachmentAsync_NullFile_ReturnsFailure()
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.UploadJobAttachmentAsync(1, null);

        // Assert
        Assert.False(result.Success);
        Assert.Equal("No file uploaded", result.ErrorMessage);
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
        Assert.False(result.Success);
        Assert.Contains("Invalid file type", result.ErrorMessage);
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
        Assert.False(result.Success);
        Assert.Contains("File size exceeds", result.ErrorMessage);
    }

    [Fact]
    public async Task UploadJobAttachmentAsync_ValidPdf_Uploads()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        var file = CreateMockFile("document.pdf", "application/pdf", 1024);

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new PutObjectResponse());

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        Assert.True(result.Success);
        Assert.Matches(@"^JobAttachments/\d{4}/\d{2}/1-\d{14}\.pdf$", result.S3Key);
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

        _s3ClientMock.PutObjectAsync(Arg.Any<PutObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new PutObjectResponse());

        // Act
        var result = await service.UploadJobAttachmentAsync(1, file);

        // Assert
        Assert.True(result.Success);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DownloadFileAsync_EmptyKey_ReturnsFailure(string? key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DownloadFileAsync(key);

        // Assert
        Assert.False(result.Success);
        Assert.Equal("File key is required", result.ErrorMessage);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task DeleteFileAsync_EmptyKey_ReturnsFalse(string? key)
    {
        // Arrange
        var service = CreateService();

        // Act
        var result = await service.DeleteFileAsync(key);

        // Assert
        Assert.False(result);
    }

    [Fact]
    public async Task DeleteFileAsync_ValidKey_DeletesFile()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteObjectResponse());

        // Act
        var result = await service.DeleteFileAsync("JobAttachments/1-test.pdf");

        // Assert
        Assert.True(result);
    }

    [Fact]
    public async Task GetDeliveryPhotosAsync_NoPhotos_ReturnsEmptyList()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(new ListObjectsV2Response { S3Objects = new List<S3Object>() });

        // Act
        var result = await service.GetDeliveryPhotosAsync(1, 2024, 1);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPickupPhotosAsync_NoPhotos_ReturnsEmptyList()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(new ListObjectsV2Response { S3Objects = new List<S3Object>() });

        // Act
        var result = await service.GetPickupPhotosAsync(1, 2024, 1);

        // Assert
        Assert.Empty(result);
    }

    [Fact]
    public async Task GetAttachedFilesAsync_ReturnsLegacyFlatAndDatedObjects()
    {
        // Arrange — clock is fixed at 2024-06-15, dated lookup will scan 2024/06 back through 2022/07.
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        const string legacyKey = "JobAttachments/1-20230101120000";
        const string datedKey = "JobAttachments/2024/06/1-20240615143000.pdf";

        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<ListObjectsV2Request>();
                var objects = req.Prefix switch
                {
                    "JobAttachments/1-" => new List<S3Object> { new() { Key = legacyKey, Size = 10 } },
                    "JobAttachments/2024/06/1-" => new List<S3Object> { new() { Key = datedKey, Size = 20 } },
                    _ => new List<S3Object>()
                };
                return new ListObjectsV2Response { S3Objects = objects };
            });

        _s3ClientMock.GetObjectAsync(Arg.Any<GetObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<GetObjectRequest>();
                var response = new GetObjectResponse
                {
                    Key = req.Key,
                    ResponseStream = new MemoryStream()
                };
                response.Metadata.Add("FileName", req.Key.EndsWith(".pdf") ? "dated.pdf" : "legacy.bin");
                return response;
            });

        // Act
        var result = await service.GetAttachedFilesAsync(1);

        // Assert — both legacy and dated objects come back, deduped if the mock ever returned them twice.
        Assert.Equal(2, result.Count);
        Assert.Contains(result, f => f.S3Key == legacyKey);
        Assert.Contains(result, f => f.S3Key == datedKey);
    }

    private static IFormFile CreateMockFile(string fileName, string contentType, long size)
    {
        var content = new byte[size];
        var stream = new MemoryStream(content);

        var fileMock = Substitute.For<IFormFile>();
        fileMock.FileName.Returns(fileName);
        fileMock.ContentType.Returns(contentType);
        fileMock.Length.Returns(size);
        fileMock.OpenReadStream().Returns(stream);
        fileMock.CopyToAsync(Arg.Any<Stream>(), Arg.Any<CancellationToken>())
            .Returns(callInfo =>
            {
                stream.Position = 0;
                return stream.CopyToAsync(callInfo.Arg<Stream>());
            });

        return fileMock;
    }

}
