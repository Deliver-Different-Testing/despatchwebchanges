using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Interfaces;

public interface IJobPhotoService
{
    // Photo/Signature methods
    Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryPhotosAsync(int jobId, int year, int month);
    Task<IReadOnlyList<S3PhotoInfo>> GetPickupPhotosAsync(int jobId, int year, int month);

    Task<AwsUploadResult> UploadJobPhotoOrSignatureAsync(int jobId, IFormFile file, JobPhotoType photoType,
        bool isPod = true, string podDescription = null);

    Task<bool> DeleteJobPhotoOrSignatureAsync(int jobId, string key);

    // Job Attachment methods
    Task<IReadOnlyList<S3FileInfo>> GetAttachedFilesAsync(int jobId);
    Task<AwsUploadResult> UploadJobAttachmentAsync(int jobId, IFormFile file);
    Task<AwsFileDownloadResult> DownloadFileAsync(string key);
    Task<bool> DeleteFileAsync(string key);
}