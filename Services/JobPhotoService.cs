using System.Net;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for managing job photos, signatures, and file attachments stored in Amazon S3.
/// </summary>
public sealed class JobPhotoService(IAmazonS3 s3Client, ITenantClock clock) : IJobPhotoService
{
    /// <summary>
    /// Retrieves delivery photos and signatures for a job from S3 storage.
    /// </summary>
    /// <param name="jobId">The job ID to get photos for.</param>
    /// <param name="year">The year folder to search in.</param>
    /// <param name="month">The month folder to search in.</param>
    /// <returns>A list of photo information including base64 encoded image data.</returns>
    public async Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryPhotosAsync(int jobId, int year, int month)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var key = $"{jobId}-";

        var s3Objects = await SearchFilesByPatternAsync(bucketName, key, year, month, JobPhotoType.Delivery);
    
        // Add defensive check
        if (s3Objects != null && s3Objects.Count != 0)
        {
            return await GetPhotoInfoFromS3ObjectsAsync(s3Objects, bucketName);
        }

        // No data
        Log.Debug("No delivery photos found for job {JobId} in {Year}/{Month:D2}", jobId, year, month);
        return [];
    }

    /// <summary>
    /// Retrieves pickup photos and scanned documents for a job from S3 storage.
    /// </summary>
    /// <param name="jobId">The job ID to get photos for.</param>
    /// <param name="year">The year folder to search in.</param>
    /// <param name="month">The month folder to search in.</param>
    /// <returns>A list of photo information including base64 encoded image data.</returns>
    public async Task<IReadOnlyList<S3PhotoInfo>> GetPickupPhotosAsync(int jobId, int year, int month)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var key = $"{jobId}-";

        var s3Objects = await SearchFilesByPatternAsync(bucketName, key, year, month, JobPhotoType.Pickup);
    
        // Add defensive check
        if (s3Objects != null && s3Objects.Count != 0)
        {
            return await GetPhotoInfoFromS3ObjectsAsync(s3Objects, bucketName);
        }

        // No data
        Log.Debug("No pickup photos found for job {JobId} in {Year}/{Month:D2}", jobId, year, month);
        return [];
    }

    /// <summary>
    /// Uploads a photo or signature file to S3 for a job.
    /// </summary>
    /// <param name="jobId">The job ID to associate the file with.</param>
    /// <param name="file">The file to upload.</param>
    /// <param name="photoType">Whether this is a delivery or pickup photo.</param>
    /// <param name="isPod">Whether this is a POD photo (true) or signature (false).</param>
    /// <param name="podDescription">Optional description for POD photos.</param>
    /// <returns>The upload result including success status and S3 key.</returns>
    public async Task<AwsUploadResult> UploadJobPhotoOrSignatureAsync(
        int jobId,
        IFormFile file,
        JobPhotoType photoType,
        bool isPod = true,
        string podDescription = null)
    {
        if (file == null || file.Length == 0)
        {
            return new AwsUploadResult { Success = false, ErrorMessage = "No file was uploaded" };
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var folder = GetUploadFolder(photoType, isPod);

            // Create the file path in format: [folder]/[year]/[month]/[jobId]-[timestamp]-[filename]
            var now = clock.TenantNow;
            var monthFolder = $"{now.Year}/{now:MM}/";

            // Extract the file extension
            var fileExtension = Path.GetExtension(file.FileName);

            // Generate a unique filename with timestamp
            var timestamp = now.ToString("yyyyMMddHHmmss");
            var filename = $"{jobId}-{timestamp}{fileExtension}";

            // Combine parts to form the full S3 key
            var key = $"{folder}/{monthFolder}{filename}";

            // Create the S3 upload request
            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var contentType = DetermineContentType(fileExtension);

            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                InputStream = memoryStream,
                ContentType = contentType
            };

            // Add metadata properly using the metadata dictionary
            if (isPod && !string.IsNullOrEmpty(podDescription))
            {
                putRequest.Metadata.Add("pod-description", podDescription);
            }

            Log.Debug("Uploading {Type} file for job {JobId} to S3 path: {Key}",
                isPod ? $"{photoType} POD photo" : $"{photoType} signature", jobId, key);

            // Execute the upload
            await s3Client.PutObjectAsync(putRequest);

            Log.Information("Successfully uploaded {Type} file for job {JobId}",
                isPod ? $"{photoType} POD photo" : $"{photoType} signature", jobId);

            // Return the uploaded file information
            return new AwsUploadResult
            {
                Success = true,
                FileName = filename,
                S3Key = key,
                ContentType = contentType,
                Size = file.Length,
                UploadDate = now,
                IsPod = isPod,
                PodDescription = podDescription
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(UploadJobPhotoOrSignatureAsync)));

            return new AwsUploadResult
            {
                Success = false,
                ErrorMessage = e.Message
            };
        }
    }

    /// <summary>
    /// Deletes a photo or signature file from S3.
    /// </summary>
    /// <param name="jobId">The job ID the file belongs to.</param>
    /// <param name="key">The S3 key of the file to delete.</param>
    /// <returns>True if deletion was successful, false otherwise.</returns>
    public async Task<bool> DeleteJobPhotoOrSignatureAsync(int jobId, string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            Log.Warning("Attempted to delete file for job {JobId} with empty key", jobId);
            return false;
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");

            var deleteRequest = new DeleteObjectRequest
            {
                BucketName = bucketName,
                Key = key
            };

            Log.Debug("Deleting file with key {Key} for job {JobId}", key, jobId);

            await s3Client.DeleteObjectAsync(deleteRequest);

            Log.Information("Successfully deleted file with key {Key} for job {JobId}", key, jobId);

            return true;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(DeleteJobPhotoOrSignatureAsync)));
            return false;
        }
    }

    /// <summary>S3 key prefix under which archived (soft-deleted) captured media is retained.</summary>
    private const string ArchivePrefix = "RestoredArchive/";

    /// <summary>
    /// Soft-deletes a job's captured photos and signatures by copying each S3 object under the
    /// <see cref="ArchivePrefix"/> prefix and then deleting the original. Reuses the same
    /// month-window prefix search the photo getters use, so exactly the objects shown against the
    /// job are archived. The copy runs first; the original is only deleted once the copy succeeds,
    /// so a failure never loses data.
    /// </summary>
    public async Task<AwsBatchOperationResult> ArchiveJobCapturedMediaAsync(int jobId, int year, int month)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var pattern = $"{jobId}-";

        var objects = new List<S3Object>();
        objects.AddRange(await SearchFilesByPatternAsync(bucketName, pattern, year, month, JobPhotoType.Delivery));
        objects.AddRange(await SearchFilesByPatternAsync(bucketName, pattern, year, month, JobPhotoType.Pickup));

        var keys = objects
            .Select(o => o.Key)
            .Distinct(StringComparer.Ordinal)
            .ToList();

        var successful = 0;
        var errors = new List<string>();

        foreach (var key in keys)
        {
            try
            {
                await s3Client.CopyObjectAsync(new CopyObjectRequest
                {
                    SourceBucket = bucketName,
                    SourceKey = key,
                    DestinationBucket = bucketName,
                    DestinationKey = $"{ArchivePrefix}{key}"
                });

                await s3Client.DeleteObjectAsync(new DeleteObjectRequest
                {
                    BucketName = bucketName,
                    Key = key
                });

                successful++;
            }
            catch (Exception e)
            {
                Log.Error(e, "{Message}",
                    ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                        nameof(ArchiveJobCapturedMediaAsync)));
                errors.Add($"{key}: {e.Message}");
            }
        }

        Log.Information("Archived {Successful}/{Total} captured media object(s) for job {JobId}",
            successful, keys.Count, jobId);

        return new AwsBatchOperationResult
        {
            TotalFiles = keys.Count,
            SuccessfulFiles = successful,
            FailedFiles = keys.Count - successful,
            ErrorMessages = errors
        };
    }

    /// <summary>
    /// Retrieves all file attachments for a job from S3.
    /// </summary>
    /// <param name="jobId">The job ID to get attachments for.</param>
    /// <returns>A list of file information including filename and size.</returns>
    public async Task<IReadOnlyList<S3FileInfo>> GetAttachedFilesAsync(int jobId)
    {
        var s3Files = new List<S3FileInfo>();

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");

            Log.Debug("Getting attached files for job {JobId}", jobId);

            var s3List = await ListJobAttachmentObjectsAsync(bucketName, jobId);

            foreach (var s3Object in s3List)
            {
                try
                {
                    var getObjectRequest = new GetObjectRequest
                    {
                        BucketName = bucketName,
                        Key = s3Object.Key
                    };

                    using var response = await s3Client.GetObjectAsync(getObjectRequest);
                    var fileName = response.Metadata["FileName"];

                    var s3FileInfo = new S3FileInfo
                    {
                        S3Key = s3Object.Key,
                        FileName = fileName,
                        LastModified = s3Object.LastModified,
                        Size = s3Object.Size
                    };

                    s3Files.Add(s3FileInfo);
                }
                catch (Exception e)
                {
                    Log.Error(e, "{Message}",
                        ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                            nameof(GetAttachedFilesAsync)));
                    // Continue processing other files even if one fails
                }
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(GetAttachedFilesAsync)));
            throw;
        }

        return s3Files;
    }

    private static readonly HashSet<string> AllowedTypes = ["image/jpeg", "image/png", "image/gif", "image/heic", "image/heif", "application/pdf"];

    /// <summary>
    /// Uploads a file attachment for a job to S3. Only allows images and PDFs up to 10MB.
    /// </summary>
    /// <param name="jobId">The job ID to attach the file to.</param>
    /// <param name="file">The file to upload.</param>
    /// <returns>The upload result including success status and S3 key.</returns>
    public async Task<AwsUploadResult> UploadJobAttachmentAsync(int jobId, IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            return new AwsUploadResult { Success = false, ErrorMessage = "No file uploaded" };
        }

        // Validate a file type
        if (!AllowedTypes.Contains(file.ContentType.ToLower()))
        {
            return new AwsUploadResult
                { Success = false, ErrorMessage = "Invalid file type. Only images and PDFs are allowed." };
        }

        // Validate file size (10MB max)
        if (file.Length > 10 * 1024 * 1024)
        {
            return new AwsUploadResult { Success = false, ErrorMessage = "File size exceeds the limit of 10MB." };
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var currentDate = clock.TenantNow;
            var monthFolder = $"{currentDate.Year}/{currentDate:MM}/";
            var timestamp = currentDate.ToString("yyyyMMddHHmmss");
            var fileExtension = Path.GetExtension(file.FileName);
            var key = $"JobAttachments/{monthFolder}{jobId}-{timestamp}{fileExtension}";

            using var memoryStream = new MemoryStream();
            await file.CopyToAsync(memoryStream);
            memoryStream.Position = 0;

            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                ContentType = file.ContentType,
                InputStream = memoryStream
            };

            putRequest.Metadata.Add("FileName", file.FileName);

            await s3Client.PutObjectAsync(putRequest);

            Log.Information("Successfully uploaded attachment {FileName} for job {JobId}", file.FileName, jobId);

            return new AwsUploadResult
            {
                Success = true,
                FileName = file.FileName,
                S3Key = key,
                ContentType = file.ContentType,
                Size = file.Length,
                UploadDate = currentDate
            };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(UploadJobAttachmentAsync)));

            return new AwsUploadResult
            {
                Success = false,
                ErrorMessage = e.Message
            };
        }
    }

    /// <summary>
    /// Downloads a file from S3 by its key.
    /// </summary>
    /// <param name="key">The S3 key of the file to download.</param>
    /// <returns>The download result including file bytes, content type, and filename.</returns>
    public async Task<AwsFileDownloadResult> DownloadFileAsync(string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            return new AwsFileDownloadResult { Success = false, ErrorMessage = "File key is required" };
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var request = new GetObjectRequest { BucketName = bucketName, Key = key };

            using var response = await s3Client.GetObjectAsync(request);

            if (response.HttpStatusCode != HttpStatusCode.OK)
            {
                return new AwsFileDownloadResult { Success = false, ErrorMessage = $"File {key} not found." };
            }

            var originalFileName = response.Metadata["FileName"];
            var contentType = response.Headers.ContentType;

            // Read the stream into a memory stream to get the bytes
            using var ms = new MemoryStream();
            await response.ResponseStream.CopyToAsync(ms);
            var fileBytes = ms.ToArray();

            return new AwsFileDownloadResult
            {
                Success = true,
                FileBytes = fileBytes,
                ContentType = contentType,
                FileName = originalFileName
            };
        }
        catch (AmazonS3Exception ex) when (ex.StatusCode == HttpStatusCode.NotFound)
        {
            return new AwsFileDownloadResult { Success = false, ErrorMessage = $"File {key} not found in bucket" };
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService), nameof(DownloadFileAsync)));
            return new AwsFileDownloadResult { Success = false, ErrorMessage = e.Message };
        }
    }

    /// <summary>
    /// Deletes a file from S3 by its key.
    /// </summary>
    /// <param name="key">The S3 key of the file to delete.</param>
    /// <returns>True if deletion was successful, false otherwise.</returns>
    public async Task<bool> DeleteFileAsync(string key)
    {
        if (string.IsNullOrEmpty(key))
        {
            Log.Warning("Attempted to delete file with empty key");
            return false;
        }

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");

            var deleteObjectRequest = new DeleteObjectRequest
            {
                BucketName = bucketName,
                Key = key
            };

            await s3Client.DeleteObjectAsync(deleteObjectRequest);

            Log.Information("Successfully deleted file {Key}", key);

            return true;
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService), nameof(DeleteFileAsync)));
            return false;
        }
    }

    /// <summary>
    /// Searches for S3 objects matching a prefix pattern.
    /// </summary>
    /// <param name="bucketName">The S3 bucket to search in.</param>
    /// <param name="pattern">The key prefix pattern to match.</param>
    /// <returns>A list of matching S3 objects.</returns>
    public async Task<IReadOnlyList<S3Object>> SearchFilesByPatternAsync(string bucketName, string pattern)
    {
        var allResults = new List<S3Object>();

        try
        {
            var request = new ListObjectsV2Request
            {
                BucketName = bucketName,
                Prefix = pattern,
                MaxKeys = 1000
            };

            ListObjectsV2Response response;
            do
            {
                response = await s3Client.ListObjectsV2Async(request);
                
                var objects = response?.S3Objects;
                if (objects is { Count: > 0 })
                {
                    allResults.AddRange(objects);
                }

                request.ContinuationToken = response?.NextContinuationToken;
            } while (response?.IsTruncated ?? false);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(SearchFilesByPatternAsync)));
            return [];
        }

        return allResults;
    }

    /// <summary>
    /// Searches for S3 objects matching a pattern within specific year/month folders based on photo type.
    /// Photos are S3-keyed by their upload instant, whereas callers pass the job's completion month, so
    /// the search spans the specified month plus the adjacent months (previous and following) to cover
    /// jobs whose upload and completion fall on opposite sides of a month boundary.
    /// </summary>
    /// <param name="bucketName">The S3 bucket to search in.</param>
    /// <param name="pattern">The key prefix pattern to match.</param>
    /// <param name="year">The year folder to search in.</param>
    /// <param name="month">The month folder to search in.</param>
    /// <param name="photoType">The type of photo to determine folder locations.</param>
    /// <returns>A list of matching S3 objects.</returns>
    public async Task<IReadOnlyList<S3Object>> SearchFilesByPatternAsync(
        string bucketName,
        string pattern,
        int year,
        int month,
        JobPhotoType photoType
    )
    {
        var allResults = new List<S3Object>();
        // Calculate the adjacent months/years (handling year rollover in both directions)
        var nextMonth = month == 12 ? 1 : month + 1;
        var nextYear = month == 12 ? year + 1 : year;
        var prevMonth = month == 1 ? 12 : month - 1;
        var prevYear = month == 1 ? year - 1 : year;

        try
        {
            var monthPrefixes = new[]
            {
                $"{year}/{month:D2}/",
                $"{prevYear}/{prevMonth:D2}/",
                $"{nextYear}/{nextMonth:D2}/"
            };
            var folders = GetFoldersByPhotoType(photoType);

            foreach (var folder in folders)
            {
                foreach (var monthPrefix in monthPrefixes)
                {
                    var request = new ListObjectsV2Request
                    {
                        BucketName = bucketName,
                        Prefix = $"{folder}/{monthPrefix}{pattern}",
                        MaxKeys = 1000
                    };

                    var response = await s3Client.ListObjectsV2Async(request);
                
                    var objects = response?.S3Objects;
                    if (objects is { Count: > 0 })
                    {
                        allResults.AddRange(objects);
                    }

                    if (allResults.Count > 0)
                    {
                        break;
                    }
                }
            }
        }
        catch (AmazonS3Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(SearchFilesByPatternAsync)));
            return [];
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(SearchFilesByPatternAsync)));
            return [];
        }

        return allResults;
    }

    /// <summary>
    /// Lists S3 objects for a job's attachments across both the legacy flat layout
    /// (<c>JobAttachments/{jobId}-...</c>) and the dated layout
    /// (<c>JobAttachments/{yyyy}/{MM}/{jobId}-...</c>). The dated layout is scanned
    /// across the last 24 calendar months so attachments uploaded any time during
    /// a job's active period are still discoverable.
    /// </summary>
    private async Task<IReadOnlyList<S3Object>> ListJobAttachmentObjectsAsync(string bucketName, int jobId)
    {
        var seenKeys = new HashSet<string>(StringComparer.Ordinal);
        var combined = new List<S3Object>();

        await AppendAsync($"JobAttachments/{jobId}-");

        var month = clock.TenantNow;
        for (var i = 0; i < 24; i++)
        {
            await AppendAsync($"JobAttachments/{month.Year}/{month:MM}/{jobId}-");
            month = month.AddMonths(-1);
        }

        return combined;

        async Task AppendAsync(string prefix)
        {
            var hits = await SearchAttachmentFilesByPatternAsync(bucketName, prefix);
            combined.AddRange(hits.Where(s3Object => seenKeys.Add(s3Object.Key)));
        }
    }

    /// <summary>
    /// Searches for attachment files matching a pattern prefix.
    /// </summary>
    private async Task<IReadOnlyList<S3Object>> SearchAttachmentFilesByPatternAsync(string bucketName, string pattern)
    {
        var allResults = new List<S3Object>();

        try
        {
            var request = new ListObjectsV2Request
            {
                BucketName = bucketName,
                Prefix = pattern,
                MaxKeys = 1000
            };

            var response = await s3Client.ListObjectsV2Async(request);
        
            // Fix: Add defensive null checking
            var objects = response?.S3Objects;
            if (objects is { Count: > 0 })
            {
                allResults.AddRange(objects);
            }
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                    nameof(SearchAttachmentFilesByPatternAsync)));
            throw;
        }

        return allResults;
    }
    
    
    /// <summary>
    /// Retrieves detailed photo information from S3 objects including base64 encoded image data.
    /// </summary>
    private async Task<IReadOnlyList<S3PhotoInfo>> GetPhotoInfoFromS3ObjectsAsync(IReadOnlyList<S3Object> s3Objects, string bucketName)
    {
        var photoInfos = new List<S3PhotoInfo>();

        foreach (var s3Object in s3Objects)
        {
            try
            {
                var getObjectRequest = new GetObjectRequest
                {
                    BucketName = bucketName,
                    Key = s3Object.Key
                };

                using var response = await s3Client.GetObjectAsync(getObjectRequest);
            
                var fileName = response.Metadata["FileName"] ?? Path.GetFileName(s3Object.Key);
                var contentType = response.Headers.ContentType ?? DetermineContentType(Path.GetExtension(fileName));
            
                // Only load data for images, not for PDFs or other files
                string data = null;
                var displayContentType = contentType;
                if (contentType.StartsWith("image/"))
                {
                    using var memoryStream = new MemoryStream();
                    await response.ResponseStream.CopyToAsync(memoryStream);
                    var imageBytes = memoryStream.ToArray();

                    // Convert browser-incompatible formats (HEIC/HEIF) to JPEG for display
                    if (contentType is "image/heic" or "image/heif")
                    {
                        imageBytes = ImageConversionHelper.ConvertToJpeg(imageBytes);
                        displayContentType = "image/jpeg";
                    }

                    data = Convert.ToBase64String(imageBytes);
                }

                var photoInfo = new S3PhotoInfo
                {
                    S3Key = s3Object.Key,
                    FileName = fileName,
                    ContentType = displayContentType,
                    LastModified = s3Object.LastModified,
                    Size = s3Object.Size,
                    Data = data
                };

                photoInfos.Add(photoInfo);
            }
            catch (Exception e)
            {
                Log.Error(e, "{Message}",
                    ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobPhotoService),
                        nameof(GetPhotoInfoFromS3ObjectsAsync)));
            }
        }

        return photoInfos;
    }

    /// <summary>
    /// Gets the S3 folder names for a photo type (signatures/documents and photos).
    /// </summary>
    private static string[] GetFoldersByPhotoType(JobPhotoType photoType) =>
        photoType switch
        {
            JobPhotoType.Delivery => ["DeliverySignatures", "DeliveryPhotos"],
            JobPhotoType.Pickup => ["PickupScannedDocuments", "PickupPhotos"],
            _ => throw new ArgumentOutOfRangeException(nameof(photoType), photoType, null)
        };

    /// <summary>
    /// Gets the appropriate upload folder based on photo type and whether it's a POD photo or signature.
    /// </summary>
    private static string GetUploadFolder(JobPhotoType photoType, bool isPod)
    {
        var folders = GetFoldersByPhotoType(photoType);
        return isPod ? folders[1] : folders[0];
    }

    /// <summary>
    /// Determines the MIME content type based on file extension.
    /// </summary>
    private static string DetermineContentType(string fileExtension) =>
        fileExtension.ToLower() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".heic" or ".heif" => "image/heic",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream" // Default content type
        };
}