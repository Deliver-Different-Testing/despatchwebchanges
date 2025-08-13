using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

public interface IPodExportService
{
    Task<JobsReportResult> GenerateJobsReportAsync(PodSearchDownloadRequest request);
}