using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Http;

namespace DespatchWeb.Interfaces;

/// <summary>
/// Service for job-related spreadsheet operations including CSV exports and file parsing.
/// </summary>
public interface IJobReportService
{
    /// <summary>
    /// Generates a CSV report of jobs matching the POD search criteria and uploads a copy to S3.
    /// </summary>
    /// <param name="request">The search parameters including date range, couriers, speeds, and clients.</param>
    /// <returns>The generated CSV file bytes and filename.</returns>
    Task<JobsReportResult> GenerateJobsReportAsync(PodSearchDownloadRequest request);

    /// <summary>
    /// Generates a client jobs report in CSV format based on search criteria.
    /// </summary>
    /// <param name="request">Search criteria for the report.</param>
    /// <returns>Tuple containing file bytes and filename.</returns>
    Task<(byte[] FileBytes, string FileName)> GenerateClientJobsReportCsvAsync(ClientJobsReportRequest request);

    /// <summary>
    /// Parses an uploaded Excel or CSV file into job manual price models.
    /// </summary>
    /// <param name="file">The uploaded spreadsheet file (xls, xlsx, or csv).</param>
    /// <returns>List of parsed job price data.</returns>
    Task<List<JobManualPriceModel>> ParseBulkPriceFileAsync(IFormFile file);

    /// <summary>
    /// Processes a job price upload file: archives to S3, parses data, and updates job prices.
    /// </summary>
    /// <param name="file">The uploaded spreadsheet file (xls, xlsx, or csv).</param>
    Task ProcessJobPriceUploadAsync(IFormFile file);
}
