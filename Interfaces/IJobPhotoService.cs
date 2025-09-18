using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using Amazon.S3.Model;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Interfaces;

public interface IJobPhotoService
{
    // Photo/Signature methods
    Task<List<byte[]>> GetDeliveryPhotosAsync(int jobId, int year, int month);
    Task<List<byte[]>> GetPickupPhotosAsync(int jobId, int year, int month);

    Task<List<S3Object>> SearchFilesByPatternAsync(string bucketName, string pattern, int year, int month,
        JobPhotoType photoType);

    Task<AwsUploadResult> UploadJobPhotoOrSignatureAsync(int jobId, IFormFile file, JobPhotoType photoType,
        bool isPod = true, string podDescription = null);

    Task<bool> DeleteJobPhotoOrSignatureAsync(int jobId, string key);

    // Job Attachment methods
    Task<bool> IsFilesAttachedToJobAsync(int jobId);
    Task<List<S3FileInfo>> GetAttachedFilesAsync(int jobId);
    Task<AwsUploadResult> UploadJobAttachmentAsync(int jobId, IFormFile file);
    Task<AwsFileDownloadResult> DownloadFileAsync(string key);
    Task<bool> DeleteFileAsync(string key);

    Task<List<S3Object>>
        SearchFilesByPatternAsync(string bucketName, string pattern); // Generic version without date/photoType

    Task<bool> FileExistsAsync(string key);
    Task<S3Object> GetFileMetadataAsync(string key);
    Task<List<S3Object>> ListAllFilesInFolderAsync(string folderPath);
    Task<long> GetTotalFileSizeForJobAsync(int jobId);
    Task<List<S3Object>> GetFilesByDateRangeAsync(string folderPath, DateTime startDate, DateTime endDate);
    Task<AwsUploadResult> CopyFileAsync(string sourceKey, string destinationKey);
    Task<bool> MoveFileAsync(string sourceKey, string destinationKey);
    Task<List<S3Object>> GetFilesByJobIdAsync(int jobId, string folderPath = null);
}