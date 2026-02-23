using System.Threading.Tasks;

namespace DespatchWeb.Interfaces;

public interface IPodReportService
{
    Task<(byte[] Bytes, string FileName)> GeneratePodReportAsync(int jobId);
}
