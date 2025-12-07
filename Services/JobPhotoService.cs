using System;
using System.Collections.Generic;
using System.IO;
using System.Net;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;
using Serilog;
using System.Linq;

namespace DespatchWeb.Services;

public class JobPhotoService(IAmazonS3 s3Client) : IJobPhotoService
{
    public async Task<List<S3PhotoInfo>> GetDeliveryPhotosAsync(int jobId, int year, int month)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var key = $"{jobId}-";

        var s3Objects = await SearchFilesByPatternAsync(bucketName, key, year, month, JobPhotoType.Delivery);
    
        // Add defensive check
        if (s3Objects != null && s3Objects.Count != 0) return await GetPhotoInfoFromS3ObjectsAsync(s3Objects, bucketName);
        
        // No data
        Log.Debug("No delivery photos found for job {JobId} in {Year}/{Month:D2}", jobId, year, month);
        return [];
    }

    public async Task<List<S3PhotoInfo>> GetPickupPhotosAsync(int jobId, int year, int month)
    {
        var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
        var key = $"{jobId}-";

        var s3Objects = await SearchFilesByPatternAsync(bucketName, key, year, month, JobPhotoType.Pickup);
    
        // Add defensive check
        if (s3Objects != null && s3Objects.Count != 0) return await GetPhotoInfoFromS3ObjectsAsync(s3Objects, bucketName);
        
        // No data
        Log.Debug("No pickup photos found for job {JobId} in {Year}/{Month:D2}", jobId, year, month);
        return [];
    }

    public async Task<AwsUploadResult> UploadJobPhotoOrSignatureAsync(
        int jobId,
        IFormFile file,
        JobPhotoType photoType,
        bool isPod = true,
        string podDescription = null)
    {
        if (file == null || file.Length == 0)
            return new AwsUploadResult { Success = false, ErrorMessage = "No file was uploaded" };

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var folder = GetUploadFolder(photoType, isPod);

            // Create the file path in format: [folder]/[year]/[month]/[jobId]-[timestamp]-[filename]
            var now = DateTime.UtcNow;
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
                putRequest.Metadata.Add("pod-description", podDescription);

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

    public async Task<List<S3FileInfo>> GetAttachedFilesAsync(int jobId)
    {
        var s3Files = new List<S3FileInfo>();

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var key = $"JobAttachments/{jobId}-";

            Log.Debug("Getting attached files with pattern {Key}", key);

            var s3List = await SearchAttachmentFilesByPatternAsync(bucketName, key);

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

    private static readonly HashSet<string> AllowedTypes = ["image/jpeg", "image/png", "image/gif", "application/pdf"];
    
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
            return new AwsUploadResult { Success = false, ErrorMessage = "File size exceeds the limit of 10MB." };

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var currentDate = DateTime.UtcNow; // You might want to inject a time service for this
            var timestamp = currentDate.ToString("yyyyMMddHHmmss");
            var key = $"JobAttachments/{jobId}-{timestamp}";

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

    public async Task<AwsFileDownloadResult> DownloadFileAsync(string key)
    {
        if (string.IsNullOrEmpty(key))
            return new AwsFileDownloadResult { Success = false, ErrorMessage = "File key is required" };

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var request = new GetObjectRequest { BucketName = bucketName, Key = key };

            using var response = await s3Client.GetObjectAsync(request);

            if (response.HttpStatusCode != HttpStatusCode.OK)
                return new AwsFileDownloadResult { Success = false, ErrorMessage = $"File {key} not found." };

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

    public async Task<List<S3Object>> SearchFilesByPatternAsync(string bucketName, string pattern)
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
                if (objects is { Count: > 0 }) allResults.AddRange(objects);
            
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

    public async Task<List<S3Object>> SearchFilesByPatternAsync(
        string bucketName,
        string pattern,
        int year,
        int month,
        JobPhotoType photoType
    )
    {
        var allResults = new List<S3Object>();
        // Calculate next month and year (handling December rollover)
        var nextMonth = month == 12 ? 1 : month + 1;
        var nextYear = month == 12 ? year + 1 : year;

        try
        {
            var monthPrefixes = new[] { $"{year}/{month:D2}/", $"{nextYear}/{nextMonth:D2}/" };
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
                    if (objects is { Count: > 0 }) allResults.AddRange(objects);

                    if (allResults.Count > 0) break;
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

    // Helper method for batch operations
    private async Task<List<S3Object>> SearchAttachmentFilesByPatternAsync(string bucketName, string pattern)
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
            if (objects is { Count: > 0 }) allResults.AddRange(objects);
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
    
    
    private async Task<List<S3PhotoInfo>> GetPhotoInfoFromS3ObjectsAsync(List<S3Object> s3Objects, string bucketName)
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
            
                var photoInfo = new S3PhotoInfo
                {
                    S3Key = s3Object.Key,
                    FileName = fileName,
                    ContentType = contentType,
                    LastModified = s3Object.LastModified,
                    Size = s3Object.Size
                };

                // Only load data for images, not for PDFs or other files
                if (contentType.StartsWith("image/"))
                {
                    using var memoryStream = new MemoryStream();
                    await response.ResponseStream.CopyToAsync(memoryStream);
                    photoInfo.Data = Convert.ToBase64String(memoryStream.ToArray());
                }

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

    private static string[] GetFoldersByPhotoType(JobPhotoType photoType)
    {
        return photoType switch
        {
            JobPhotoType.Delivery => ["DeliverySignatures", "DeliveryPhotos"],
            JobPhotoType.Pickup => ["PickupScannedDocuments", "PickupPhotos"],
            _ => throw new ArgumentOutOfRangeException(nameof(photoType), photoType, null)
        };
    }

    private static string GetUploadFolder(JobPhotoType photoType, bool isPod)
    {
        var folders = GetFoldersByPhotoType(photoType);
        return isPod ? folders[1] : folders[0];
    }

    private static string DetermineContentType(string fileExtension)
    {
        return fileExtension.ToLower() switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".gif" => "image/gif",
            ".pdf" => "application/pdf",
            _ => "application/octet-stream" // Default content type
        };
    }
}