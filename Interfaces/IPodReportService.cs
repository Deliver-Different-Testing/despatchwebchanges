namespace DespatchWeb.Interfaces;

public interface IPodReportService
{
    Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId);
    Task<(byte[] Bytes, string FileName)> GeneratePodSpreadsheetAsync(int jobId);
    Task SendPodEmailAsync(int jobId, List<string> recipients, string subject, string body);

    /// <summary>
    /// Appends the job's S3 delivery photos and signature as extra pages onto an
    /// already-rendered POD PDF (e.g. a branded overlay that can't fetch them).
    /// Returns the input unchanged when the job has no delivery images.
    /// </summary>
    Task<byte[]> AppendDeliveryPhotosAsync(byte[] pdfBytes, int jobId);
}
