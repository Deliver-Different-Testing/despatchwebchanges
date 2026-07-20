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

    // A job booked/delivered late on the last day of a month can have its POD photo uploaded
    // (and thus S3-keyed) in that month, while the job's CompletedTime rolls over to the first
    // of the next month. Retrieval is keyed off CompletedTime, so it must also look back a month.
    [Fact]
    public async Task GetDeliveryPhotosAsync_PhotoUploadedInPreviousMonth_IsFound()
    {
        // Arrange — photo physically stored under June, completion recorded in July.
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        const string juneKey = "DeliveryPhotos/2024/06/1-20240630235500.jpg";
        StubSingleObjectForPrefix("DeliveryPhotos/2024/06/1-", juneKey);

        // Act — retrieval anchored on the July completion month.
        var result = await service.GetDeliveryPhotosAsync(1, 2024, 7);

        // Assert
        Assert.Contains(result, p => p.S3Key == juneKey);
    }

    [Fact]
    public async Task GetDeliveryPhotosAsync_PhotoInPreviousMonthAcrossYearBoundary_IsFound()
    {
        // Arrange — photo stored December 2023, completion recorded January 2024.
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        const string decKey = "DeliveryPhotos/2023/12/1-20231231235500.jpg";
        StubSingleObjectForPrefix("DeliveryPhotos/2023/12/1-", decKey);

        // Act
        var result = await service.GetDeliveryPhotosAsync(1, 2024, 1);

        // Assert
        Assert.Contains(result, p => p.S3Key == decKey);
    }

    // Returns the given object only for the matching prefix (and downloads a small image body
    // for it), so a photo can be placed in exactly one month folder.
    private void StubSingleObjectForPrefix(string prefix, string key)
    {
        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<ListObjectsV2Request>();
                var objects = req.Prefix == prefix
                    ? new List<S3Object> { new() { Key = key, Size = 3 } }
                    : new List<S3Object>();
                return new ListObjectsV2Response { S3Objects = objects };
            });

        _s3ClientMock.GetObjectAsync(Arg.Any<GetObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<GetObjectRequest>();
                var response = new GetObjectResponse
                {
                    Key = req.Key,
                    ResponseStream = new MemoryStream([1, 2, 3])
                };
                response.Metadata.Add("FileName", Path.GetFileName(req.Key));
                return response;
            });
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

    [Fact]
    public async Task ArchiveJobCapturedMediaAsync_ArchivesCapturedMedia_MovesEachUnderArchivePrefix()
    {
        // Arrange — one object in each of the four captured-media folders for the completion month.
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        var keysByPrefix = new Dictionary<string, string>
        {
            ["DeliverySignatures/2024/07/5-"] = "DeliverySignatures/2024/07/5-20240705120000.png",
            ["DeliveryPhotos/2024/07/5-"] = "DeliveryPhotos/2024/07/5-20240705120100.jpg",
            ["PickupScannedDocuments/2024/07/5-"] = "PickupScannedDocuments/2024/07/5-20240705120200.pdf",
            ["PickupPhotos/2024/07/5-"] = "PickupPhotos/2024/07/5-20240705120300.jpg",
        };
        StubListByPrefixMap(keysByPrefix);
        _s3ClientMock.CopyObjectAsync(Arg.Any<CopyObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new CopyObjectResponse());
        _s3ClientMock.DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteObjectResponse());

        // Act
        var result = await service.ArchiveJobCapturedMediaAsync(5, 2024, 7);

        // Assert
        Assert.Equal(4, result.TotalFiles);
        Assert.Equal(4, result.SuccessfulFiles);
        Assert.Equal(0, result.FailedFiles);
        Assert.True(result.IsSuccess);

        foreach (var key in keysByPrefix.Values)
        {
            await _s3ClientMock.Received(1).CopyObjectAsync(
                Arg.Is<CopyObjectRequest>(r =>
                    r.SourceKey == key &&
                    r.DestinationKey == $"RestoredArchive/{key}" &&
                    r.SourceBucket == "test-bucket" &&
                    r.DestinationBucket == "test-bucket"),
                Arg.Any<CancellationToken>());
            await _s3ClientMock.Received(1).DeleteObjectAsync(
                Arg.Is<DeleteObjectRequest>(r => r.Key == key),
                Arg.Any<CancellationToken>());
        }
    }

    [Fact]
    public async Task ArchiveJobCapturedMediaAsync_CopyFails_DoesNotDeleteOriginalAndCountsFailure()
    {
        // Arrange — the copy throws, so the original must be kept (never soft-delete without a backup).
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        const string photoKey = "DeliveryPhotos/2024/07/5-20240705120100.jpg";
        StubListByPrefixMap(new Dictionary<string, string> { ["DeliveryPhotos/2024/07/5-"] = photoKey });

        _s3ClientMock.CopyObjectAsync(Arg.Any<CopyObjectRequest>(), Arg.Any<CancellationToken>())
            .ThrowsAsync(new AmazonS3Exception("copy failed"));

        // Act
        var result = await service.ArchiveJobCapturedMediaAsync(5, 2024, 7);

        // Assert
        Assert.Equal(1, result.TotalFiles);
        Assert.Equal(0, result.SuccessfulFiles);
        Assert.Equal(1, result.FailedFiles);
        Assert.False(result.IsSuccess);
        await _s3ClientMock.DidNotReceive()
            .DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ArchiveJobCapturedMediaAsync_DoesNotTouchJobAttachments()
    {
        // Arrange — only the four captured-media folders are searched; a JobAttachments object,
        // even though it exists for the job, must never be archived.
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();

        const string photoKey = "DeliveryPhotos/2024/07/5-20240705120100.jpg";
        const string attachmentKey = "JobAttachments/2024/07/5-20240705120400.pdf";
        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<ListObjectsV2Request>();
                List<S3Object> objects = req.Prefix switch
                {
                    "DeliveryPhotos/2024/07/5-" => [new S3Object { Key = photoKey, Size = 3 }],
                    _ when req.Prefix.StartsWith("JobAttachments/") =>
                        [new S3Object { Key = attachmentKey, Size = 3 }],
                    _ => []
                };
                return new ListObjectsV2Response { S3Objects = objects };
            });
        _s3ClientMock.CopyObjectAsync(Arg.Any<CopyObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new CopyObjectResponse());
        _s3ClientMock.DeleteObjectAsync(Arg.Any<DeleteObjectRequest>(), Arg.Any<CancellationToken>())
            .Returns(new DeleteObjectResponse());

        // Act
        var result = await service.ArchiveJobCapturedMediaAsync(5, 2024, 7);

        // Assert
        Assert.Equal(1, result.TotalFiles);
        await _s3ClientMock.DidNotReceive().CopyObjectAsync(
            Arg.Is<CopyObjectRequest>(r => r.SourceKey == attachmentKey), Arg.Any<CancellationToken>());
        await _s3ClientMock.DidNotReceive().DeleteObjectAsync(
            Arg.Is<DeleteObjectRequest>(r => r.Key == attachmentKey), Arg.Any<CancellationToken>());
    }

    [Fact]
    public async Task ArchiveJobCapturedMediaAsync_NoMedia_ReturnsEmptySuccess()
    {
        // Arrange
        Environment.SetEnvironmentVariable("S3BucketMars", "test-bucket");
        var service = CreateService();
        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(new ListObjectsV2Response { S3Objects = new List<S3Object>() });

        // Act
        var result = await service.ArchiveJobCapturedMediaAsync(5, 2024, 7);

        // Assert
        Assert.Equal(0, result.TotalFiles);
        Assert.True(result.IsSuccess);
        await _s3ClientMock.DidNotReceive()
            .CopyObjectAsync(Arg.Any<CopyObjectRequest>(), Arg.Any<CancellationToken>());
    }

    // Returns a single object for each ListObjectsV2 whose prefix matches a map key (exact match),
    // so a captured-media object can be placed in a specific folder/month for the archive search.
    private void StubListByPrefixMap(IReadOnlyDictionary<string, string> keysByPrefix)
    {
        _s3ClientMock.ListObjectsV2Async(Arg.Any<ListObjectsV2Request>(), Arg.Any<CancellationToken>())
            .Returns(call =>
            {
                var req = call.Arg<ListObjectsV2Request>();
                var objects = keysByPrefix.TryGetValue(req.Prefix, out var key)
                    ? new List<S3Object> { new() { Key = key, Size = 3 } }
                    : new List<S3Object>();
                return new ListObjectsV2Response { S3Objects = objects };
            });
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
