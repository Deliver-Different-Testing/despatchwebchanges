using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.EntityClasses;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for generating client jobs reports in CSV format
/// </summary>
public class ClientJobsReportService(
    IJobRepository jobRepository,
    ITenantInfoService infoService,
    IAmazonS3 s3Client) : IClientJobsReportService
{
    public async Task<(byte[] FileBytes, string FileName)> GenerateClientJobsReportCsvAsync(ClientJobsReportRequest request)
    {
        try
        {
            var currentDate = infoService.GetCurrentTenantTime();

            // Fetch data from stored procedure
            var data = await jobRepository.GetClientJobsReportDataAsync(request);

            // Validate that data was returned
            if (data == null || data.Count == 0)
            {
                throw new InvalidOperationException("No data found for the selected criteria. Please adjust your search parameters and try again.");
            }

            // Get client code from the first record's ucclLegalName or use "Unknown"
            // The SP returns ucclLegalName which we can use to identify the client
            var clientCode = data.FirstOrDefault()?.ucclLegalName?.Replace(" ", "_") ?? "Unknown";

            // Sanitize client code for filename (remove invalid characters)
            clientCode = SanitizeFilename(clientCode);

            // Generate CSV
            var csvBytes = await GenerateCsvAsync(data);

            // Build filename with client code
            var filename = $"ClientJobsReport_{clientCode}_{currentDate:yyyyMMddHHmmssfff}.csv";
            await UploadToS3Async(csvBytes, currentDate, clientCode);

            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(ClientJobsReportService),
                    nameof(GenerateClientJobsReportCsvAsync)));
            throw;
        }
    }

    private static async Task<byte[]> GenerateCsvAsync(IEnumerable<PerformanceSpendReportModel> data)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, Encoding.UTF8);

        // Write header
        await writer.WriteLineAsync(GetCsvHeader());

        // Write data rows
        foreach (var item in data)
        {
            await writer.WriteLineAsync(FormatDataRow(item));
        }

        await writer.FlushAsync();
        return stream.ToArray();
    }

    private static readonly Dictionary<string, Func<PerformanceSpendReportModel, string>> CsvColumns = new()
    {
        ["Date"] = x => FormatField(x.Date),
        ["Booked Time"] = x => FormatField(x.Booked),
        ["Booker"] = x => FormatField(x.Booker),
        ["Ref A"] = x => FormatField(x.RefA),
        ["Ref B"] = x => FormatField(x.RefB),
        ["Job Number"] = x => FormatField(x.JobNumber),
        ["Urgent Ref"] = x => FormatField(x.UrgentRef),
        ["Raw Base Amount"] = x => string.Empty, // Not available in SP - would need pricing breakdown table
        ["Fuel Surcharge Amount"] = x => string.Empty, // Not available in SP - would need pricing breakdown table
        ["Charge Excl GST"] = x => FormatField(x.ChargeExclGST),
        ["From Suburb"] = x => FormatField(x.From),
        ["From Postcode"] = x => FormatField(x.FromPostcode),
        ["From Address"] = x => FormatField(x.ucjbFromAddr),
        ["To Suburb"] = x => FormatField(x.To),
        ["To Postcode"] = x => FormatField(x.ToPostcode),
        ["To Address"] = x => FormatField(x.Address),
        ["Picked up time"] = x => FormatField(x.PickedUpTime),
        ["Delivered"] = x => FormatField(x.Delivered),
        ["Total Time"] = x => FormatField(x.TotalTime),
        ["POD Name"] = x => FormatField(x.PODName),
        ["Achieved Speed"] = x => FormatField(x.AchievedSpeed),
        ["Notes"] = x => FormatField(x.Notes),
        ["Quantity"] = x => FormatField(x.Quantity),
        ["Weight"] = x => FormatField(x.Weight),
        ["Vehicle"] = x => FormatField(x.Vehicle),
        ["Type"] = x => FormatField(x.ucjbType),
        ["Month"] = x => FormatField(x.ucjbMonth),
        ["Year"] = x => FormatField(x.ucjbYear),
        ["Courier Number"] = x => FormatField(x.Code),
        ["Courier Name"] = x => FormatField(x.uccrName),
        ["Invoice No"] = x => FormatField(x.ucjbInvoiceNo),
        ["Account No."] = x => FormatField(x.ucjbClientID),
        ["Client Notes"] = x => FormatField(x.ucclNote)
    };

    private static string GetCsvHeader() => string.Join(",", CsvColumns.Keys);

    private static string FormatDataRow(PerformanceSpendReportModel x)
    {
        var values = CsvColumns.Values.Select(extractor => extractor(x));
        return string.Join(",", values);
    }

    /// <summary>
    /// Formats a field value for CSV, escaping commas and quotes
    /// </summary>
    private static string FormatField(string value)
    {
        if (string.IsNullOrEmpty(value))
            return string.Empty;

        // Escape quotes by doubling them
        var escaped = value.Replace("\"", "\"\"");

        // Wrap in quotes if contains comma, quote, or newline
        if (escaped.Contains(',') || escaped.Contains('"') || escaped.Contains('\n') || escaped.Contains('\r'))
        {
            return $"\"{escaped}\"";
        }

        return escaped;
    }

    /// <summary>
    /// Sanitizes a string to be safe for use in a filename
    /// </summary>
    private static string SanitizeFilename(string filename)
    {
        if (string.IsNullOrEmpty(filename))
            return "Unknown";

        // Remove invalid filename characters
        var invalidChars = Path.GetInvalidFileNameChars();
        var sanitized = new string(filename
            .Where(c => !invalidChars.Contains(c))
            .ToArray());

        // Limit length to 50 characters
        if (sanitized.Length > 50)
            sanitized = sanitized.Substring(0, 50);

        return string.IsNullOrWhiteSpace(sanitized) ? "Unknown" : sanitized;
    }

    private async Task UploadToS3Async(byte[] csvBytes, DateTime currentDate, string clientCode)
    {
#if DEBUG
        // Skip S3 upload in debug mode
        Log.Debug("Debug mode: Skipping S3 upload for client jobs report.");
        return;
#else
        var folder = currentDate.ToString("yyyyMM");
        var timestamp = currentDate.ToString("yyyyMMddHHmmss");
        var key = $"ClientJobsReports/{folder}/ClientJobsReport_{clientCode}_{timestamp}.csv";

        using var ms = new MemoryStream(csvBytes);

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            if (string.IsNullOrEmpty(bucketName))
            {
                Log.Warning("S3BucketMars environment variable not set. Skipping S3 upload for client jobs report.");
                return;
            }

            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                ContentType = "text/csv",
                InputStream = ms
            };

            await s3Client.PutObjectAsync(putRequest);
            Log.Information("Client jobs report uploaded to S3: {Bucket}/{Key}", bucketName, key);
        }
        catch (Exception e)
        {
            Log.Error(e, "Failed to upload client jobs report to S3: {Message}", e.Message);
            // Don't throw - allow download to continue even if S3 upload fails
        }
#endif
    }
}
