namespace DespatchWeb.Interfaces;

public interface IPodReportService
{
    Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId);
    Task<(byte[] Bytes, string FileName)> GeneratePodSpreadsheetAsync(int jobId);
    Task QueuePodEmailAsync(int jobId, List<string> recipients, string subject, string body);
}
