using DespatchWeb.Enums;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;

namespace DespatchWeb.Interfaces;

public interface IJobPhotoService
{
    // Photo/Signature methods
    Task<IReadOnlyList<S3PhotoInfo>> GetDeliveryPhotosAsync(int jobId, int year, int month);
    Task<IReadOnlyList<S3PhotoInfo>> GetPickupPhotosAsync(int jobId, int year, int month);

    Task<AwsUploadResult> UploadJobPhotoOrSignatureAsync(int jobId, IFormFile file, JobPhotoType photoType,
        bool isPod = true, string podDescription = null);

    Task<bool> DeleteJobPhotoOrSignatureAsync(int jobId, string key);

    /// <summary>
    /// Soft-deletes all captured photos and signatures for a job (delivery photos, delivery
    /// signatures, pickup photos and pickup scanned documents) by moving each S3 object under the
    /// <c>RestoredArchive/</c> prefix. User-uploaded job attachments are not touched. The bytes are
    /// retained (recoverable) but no longer returned by the photo getters.
    /// </summary>
    /// <param name="jobId">The job whose captured media should be archived.</param>
    /// <param name="year">The completion year used to locate the S3 folders.</param>
    /// <param name="month">The completion month used to locate the S3 folders.</param>
    Task<AwsBatchOperationResult> ArchiveJobCapturedMediaAsync(int jobId, int year, int month);

    // Job Attachment methods
    Task<IReadOnlyList<S3FileInfo>> GetAttachedFilesAsync(int jobId);
    Task<AwsUploadResult> UploadJobAttachmentAsync(int jobId, IFormFile file);
    Task<AwsFileDownloadResult> DownloadFileAsync(string key);
    Task<bool> DeleteFileAsync(string key);
}