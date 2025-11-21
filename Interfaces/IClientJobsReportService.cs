using System.Threading.Tasks;
using DespatchWeb.Models.RequestModels;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for generating client jobs reports in various formats
/// </summary>
public interface IClientJobsReportService
{
    /// <summary>
    /// Generates a client jobs report in CSV format based on search criteria
    /// </summary>
    /// <param name="request">Search criteria for the report</param>
    /// <returns>Tuple containing file bytes and filename</returns>
    Task<(byte[] FileBytes, string FileName)> GenerateClientJobsReportCsvAsync(ClientJobsReportRequest request);
}
