using System.Data;
using System.Diagnostics;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Dto;
using DespatchWeb.Models.RequestModels;
using ExcelDataReader;
using Serilog;

namespace DespatchWeb.Services;

/// <summary>
/// Service for job-related spreadsheet operations including CSV exports, file parsing, and S3 archival.
/// </summary>
public sealed class JobReportService(
    IJobQueryRepository jobQueryRepository,
    IJobCommandRepository jobCommandRepository,
    IRecurringJobRepository recurringJobRepository,
    ITenantClock clock,
    IAmazonS3 s3Client) : IJobReportService
{
    private static readonly string[] ValidFileExtensions = [".xls", ".xlsx", ".csv"];

    private static readonly JsonSerializerOptions BulkPriceSerializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        NumberHandling = JsonNumberHandling.AllowReadingFromString,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    private static readonly JsonSerializerOptions BulkPriceDeserializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        NumberHandling = JsonNumberHandling.AllowReadingFromString | JsonNumberHandling.AllowNamedFloatingPointLiterals,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull
    };

    /// <summary>
    /// Generates a CSV report of jobs matching the POD search criteria and uploads a copy to S3.
    /// </summary>
    public async Task<JobsReportResult> GenerateJobsReportAsync(PodSearchDownloadRequest request)
    {
        var currentDate = clock.TenantNow;

        var data = await jobQueryRepository.PodSearchDownloadAsync(
            request.CourierIds,
            request.SpeedIds,
            request.Wild ?? string.Empty,
            request.Job ?? string.Empty,
            request.FromDate.DateTime.ResetTimeToStartOfDay(),
            request.ToDate.DateTime.ResetTimeToEndOfDay(),
            request.ClientIds,
            request.JobId
        );

        var csvBytes = await GeneratePodSearchCsvAsync(data);
        var filename = $"Jobs {currentDate:yyyyMMddHHmmssfff}.csv";

        // Fire and forget S3 upload to avoid blocking the response
        _ = Task.Run(async () =>
        {
            try { await UploadToS3Async(csvBytes, $"Jobs/{currentDate:yyyy}/{currentDate:MM}/Jobs-{currentDate:yyyyMMddHHmmss}", "S3BucketMars"); }
            catch (Exception ex) { Log.Error(ex, "Background S3 upload failed for jobs report"); }
        });

        return new JobsReportResult
        {
            FileBytes = csvBytes,
            FileName = filename
        };
    }

    private static async Task<byte[]> GeneratePodSearchCsvAsync(IEnumerable<dynamic> data)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, new UTF8Encoding(true));

        await writer.WriteLineAsync(string.Join(",", PodSearchCsvColumns.Keys));
        foreach (var item in data)
        {
            var values = PodSearchCsvColumns.Values.Select(extractor => extractor(item) ?? string.Empty);
            await writer.WriteLineAsync(string.Join(",", values));
        }

        await writer.FlushAsync();
        stream.Position = 0;
        return stream.ToArray();
    }

    private static readonly Dictionary<string, Func<dynamic, string>> PodSearchCsvColumns = new()
    {
        ["Id"] = x => x.Id?.ToString(),
        ["JobNumber"] = x => FormatCsvField(x.JobNumber),
        ["CustomerName"] = x => x.CustomerName?.ToString(),
        ["CourierCode"] = x => FormatCsvField(x.CourierCode),
        ["BookDate"] = x => ((DateTime?)x.BookDate)?.ToString("yyyy-MM-dd HH:mm:ss"),
        ["PickedUpDate"] = x => ((DateTime?)x.PickedUpDate)?.ToString("yyyy-MM-dd HH:mm:ss"),
        ["DeliveredDate"] = x => ((DateTime?)x.DeliveredDate)?.ToString("yyyy-MM-dd HH:mm:ss"),
        ["Amount"] = x => x.Amount?.ToString(),
        ["Fuel"] = x => x.Fuel?.ToString(),
        ["Ppd"] = x => x.Ppd?.ToString(),
        ["CourierPayment"] = x => x.CourierPayment?.ToString(),
        ["CourierFuel"] = x => x.CourierFuel?.ToString(),
        ["CourierBonus"] = x => x.CourierBonus?.ToString(),
        ["RawBaseAmount"] = x => x.RawBaseAmount?.ToString(),
        ["Agent/Airline Name"] = x => x.AgentAirlineName?.ToString(),
        ["AWB#"] = x => x.AWB?.ToString(),
        ["Quantity"] = x => x.Quantity?.ToString(),
        ["Weight"] = x => x.Weight?.ToString(),
        ["Size"] = x => x.Size?.ToString(),
        ["StatusName"] = x => x.StatusName?.ToString(),
        ["PickupAddressLine1"] = x => FormatCsvField(x.PickupAddressLine1),
        ["PickupAddressLine2"] = x => FormatCsvField(x.PickupAddressLine2),
        ["PickupAddressLine3"] = x => FormatCsvField(x.PickupAddressLine3),
        ["PickupAddressLine4"] = x => FormatCsvField(x.PickupAddressLine4),
        ["PickupAddressLine5"] = x => FormatCsvField(x.PickupAddressLine5),
        ["PickupAddressLine6"] = x => FormatCsvField(x.PickupAddressLine6),
        ["PickupAddressLine7"] = x => FormatCsvField(x.PickupAddressLine7),
        ["PickupAddressLine8"] = x => FormatCsvField(x.PickupAddressLine8),
        ["DeliveryAddressLine1"] = x => FormatCsvField(x.DeliveryAddressLine1),
        ["DeliveryAddressLine2"] = x => FormatCsvField(x.DeliveryAddressLine2),
        ["DeliveryAddressLine3"] = x => FormatCsvField(x.DeliveryAddressLine3),
        ["DeliveryAddressLine4"] = x => FormatCsvField(x.DeliveryAddressLine4),
        ["DeliveryAddressLine5"] = x => FormatCsvField(x.DeliveryAddressLine5),
        ["DeliveryAddressLine6"] = x => FormatCsvField(x.DeliveryAddressLine6),
        ["DeliveryAddressLine7"] = x => FormatCsvField(x.DeliveryAddressLine7),
        ["DeliveryAddressLine8"] = x => FormatCsvField(x.DeliveryAddressLine8),
        ["ClientReferenceA"] = x => FormatCsvField(x.ClientReferenceA),
        ["ClientReferenceB"] = x => FormatCsvField(x.ClientReferenceB),
        ["ClientReferenceC"] = x => FormatCsvField(x.ClientReferenceC),
        ["OurReference"] = x => FormatCsvField(x.OurReference),
        ["Speed"] = x => x.Speed?.ToString(),
        ["Notes"] = x => FormatCsvField(x.Notes),
        ["InvoiceNumber"] = x => x.InvoiceNumber?.ToString(),
        ["InvoiceDate"] = x => ((DateTime?)x.InvoiceDate)?.ToString("yyyy-MM-dd HH:mm:ss"),
        ["IsArchived"] = x => x.IsArchived?.ToString(),
        ["LoggedInContact"] = x => FormatCsvField(x.LoggedInContact),
        ["Void"] = x => x.Void?.ToString()
    };

    /// <summary>
    /// Generates a client jobs report in CSV format based on search criteria.
    /// </summary>
    public async Task<(byte[] FileBytes, string FileName)> GenerateClientJobsReportCsvAsync(ClientJobsReportRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await jobQueryRepository.GetClientJobsReportDataAsync(request);

            var clientCode = data.Count > 0
                ? SanitizeFilename(data[0].UcclLegalName?.Replace(" ", "_") ?? "Unknown")
                : "NoData";
            var csvBytes = await GenerateClientJobsCsvAsync(data);
            var filename = $"ClientJobsReport_{clientCode}_{currentDate:yyyyMMddHHmmssfff}.csv";

            if (!Debugger.IsAttached)
            {
                // Fire and forget S3 upload to avoid blocking the response
                _ = Task.Run(async () =>
                {
                    try
                    {
                        await UploadToS3Async(
                            csvBytes,
                            $"ClientJobsReports/{currentDate:yyyy}/{currentDate:MM}/ClientJobsReport_{clientCode}_{currentDate:yyyyMMddHHmmss}.csv",
                            "S3BucketMars");
                    }
                    catch (Exception ex) { Log.Error(ex, "Background S3 upload failed for client jobs report {ClientCode}", clientCode); }
                });
            }

            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobReportService), nameof(GenerateClientJobsReportCsvAsync)));
            throw;
        }
    }

    private static async Task<byte[]> GenerateClientJobsCsvAsync(IEnumerable<PerformanceSpendReportModel> data)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, Encoding.UTF8);

        await writer.WriteLineAsync(string.Join(",", ClientJobsCsvColumns.Keys));
        foreach (var item in data)
        {
            var values = ClientJobsCsvColumns.Values.Select(extractor => extractor(item));
            await writer.WriteLineAsync(string.Join(",", values));
        }

        await writer.FlushAsync();
        return stream.ToArray();
    }

    private static readonly Dictionary<string, Func<PerformanceSpendReportModel, string>> ClientJobsCsvColumns = new()
    {
        ["Date"] = x => FormatCsvField(x.Date),
        ["Booked Time"] = x => FormatCsvField(x.Booked),
        ["Booker"] = x => FormatCsvField(x.Booker),
        ["Ref A"] = x => FormatCsvField(x.RefA),
        ["Ref B"] = x => FormatCsvField(x.RefB),
        ["Job Number"] = x => FormatCsvField(x.JobNumber),
        ["Urgent Ref"] = x => FormatCsvField(x.UrgentRef),
        ["Raw Base Amount"] = x => FormatCsvField(x.RawBaseAmount),
        ["Fuel Surcharge Amount"] = x => FormatCsvField(x.FuelSurchargeAmount),
        ["Charge Excl GST"] = x => FormatCsvField(x.ChargeExclGst),
        ["From Suburb"] = x => FormatCsvField(x.From),
        ["From Postcode"] = x => FormatCsvField(x.FromPostcode),
        ["From Address"] = x => FormatCsvField(x.UcjbFromAddr),
        ["To Suburb"] = x => FormatCsvField(x.To),
        ["To Postcode"] = x => FormatCsvField(x.ToPostcode),
        ["To Address"] = x => FormatCsvField(x.Address),
        ["Picked up time"] = x => FormatCsvField(x.PickedUpTime),
        ["Delivered"] = x => FormatCsvField(x.Delivered),
        ["Total Time"] = x => FormatCsvField(x.TotalTime),
        ["POD Name"] = x => FormatCsvField(x.PodName),
        ["Achieved Speed"] = x => FormatCsvField(x.AchievedSpeed),
        ["Notes"] = x => FormatCsvField(x.Notes),
        ["Quantity"] = x => FormatCsvField(x.Quantity),
        ["Weight"] = x => FormatCsvField(x.Weight),
        ["Vehicle"] = x => FormatCsvField(x.Vehicle),
        ["Type"] = x => FormatCsvField(x.UcjbType),
        ["Month"] = x => FormatCsvField(x.UcjbMonth),
        ["Year"] = x => FormatCsvField(x.UcjbYear),
        ["Courier Number"] = x => FormatCsvField(x.Code),
        ["Courier Name"] = x => FormatCsvField(x.UccrName),
        ["Invoice No"] = x => FormatCsvField(x.UcjbInvoiceNo),
        ["Account No."] = x => FormatCsvField(x.UcjbClientId),
        ["Client Notes"] = x => FormatCsvField(x.UcclNote)
    };

    /// <summary>
    /// Parses an uploaded Excel or CSV file into job manual price models.
    /// </summary>
    public async Task<IReadOnlyList<JobManualPriceModel>> ParseBulkPriceFileAsync(IFormFile file)
    {
        ValidateUploadedFile(file);

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        memoryStream.Position = 0;

        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);

        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        using var reader = fileExtension == ".csv"
            ? ExcelReaderFactory.CreateCsvReader(memoryStream)
            : ExcelReaderFactory.CreateReader(memoryStream);

        var output = reader
            .AsDataSet(new ExcelDataSetConfiguration
            {
                ConfigureDataTable = _ => new ExcelDataTableConfiguration { UseHeaderRow = true }
            })
            .Tables[0];

        var rows = new List<Dictionary<string, object>>();
        foreach (DataRow row in output.Rows)
        {
            var dict = new Dictionary<string, object>();
            foreach (DataColumn col in output.Columns)
            {
                var value = row[col];
                dict[col.ColumnName] = value == DBNull.Value ? null : value;
            }
            rows.Add(dict);
        }

        var sResult = JsonSerializer.Serialize(rows, BulkPriceSerializeOptions).Replace("\"\"", "null");

        return JsonSerializer.Deserialize<List<JobManualPriceModel>>(sResult, BulkPriceDeserializeOptions) ?? [];
    }

    /// <summary>
    /// Processes a job price upload file: archives to S3, parses data, and updates job prices.
    /// </summary>
    public async Task ProcessJobPriceUploadAsync(IFormFile file)
    {
        ValidateUploadedFile(file);

        var currentDate = clock.TenantNow;
        await ArchiveUploadedFileToS3Async(file, currentDate);

        var parsedData = await ParseBulkPriceFileAsync(file);
        if (parsedData.Count > 0)
        {
            await jobCommandRepository.UpdateManualPriceAsync(parsedData);
        }
    }

    /// <summary>
    /// Generates a CSV export of all recurring jobs matching the search criteria.
    /// </summary>
    public async Task<(byte[] FileBytes, string FileName)> GenerateRecurringJobsCsvAsync(RecurringJobQueryRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await recurringJobRepository.GetAllRecurringJobsForExportAsync(request);

            var csvBytes = await GenerateRecurringJobsCsvBytesAsync(data);
            // Filename suffix honours the new RecurringMode filter when
            // present, falling back to the legacy bool for old clients.
            var statusText = request.RecurringMode.HasValue
                ? request.RecurringMode.Value.ToString().ToLowerInvariant()
                : request.Active ? "active" : "inactive";
            var filename = $"recurring-jobs-{statusText}-{currentDate:yyyy-MM-dd-HHmm}.csv";

            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(JobReportService), nameof(GenerateRecurringJobsCsvAsync)));
            throw;
        }
    }

    private static async Task<byte[]> GenerateRecurringJobsCsvBytesAsync(IEnumerable<PrebookListViewModel> data)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, new UTF8Encoding(true));

        await writer.WriteLineAsync(string.Join(",", RecurringJobsCsvColumns.Keys));
        foreach (var item in data)
        {
            var values = RecurringJobsCsvColumns.Values.Select(extractor => extractor(item));
            await writer.WriteLineAsync(string.Join(",", values));
        }

        await writer.FlushAsync();
        return stream.ToArray();
    }

    private static string FormatAddress(AddressViewModel addr)
    {
        if (addr == null)
        {
            return string.Empty;
        }

        if (!string.IsNullOrEmpty(addr.FullAddress))
        {
            return FormatCsvField(addr.FullAddress);
        }

        var addressLines = new[]
        {
            addr.AddressLine1, addr.AddressLine2, addr.AddressLine3, addr.AddressLine4,
            addr.AddressLine5, addr.AddressLine6, addr.AddressLine7, addr.AddressLine8
        }.Where(line => !string.IsNullOrWhiteSpace(line));

        return FormatCsvField(string.Join(", ", addressLines));
    }

    private static readonly Dictionary<string, Func<PrebookListViewModel, string>> RecurringJobsCsvColumns = new()
    {
        ["Job Number"] = x => FormatCsvField(x.JobNo),
        ["Client"] = x => FormatCsvField(x.Client),
        ["Booked"] = x => x.Booked != default ? x.Booked.ToString("dd/MM/yyyy HH:mm") : string.Empty,
        ["Next Due"] = x => x.NextDueTime.HasValue ? x.NextDueTime.Value.ToString("dd/MM/yyyy HH:mm") : string.Empty,
        ["Courier"] = x => FormatCsvField(x.Courier),
        ["Speed"] = x => FormatCsvField(x.Speed),
        ["Pickup Address"] = x => FormatAddress(x.PickupAddress),
        ["Delivery Address"] = x => FormatAddress(x.DeliveryAddress),
        // Mode + pricing audit columns (Steve 2026-06-09): lets ops eyeball
        // RawBaseAmount vs headline so fuel drift is visible row-by-row,
        // and surfaces Manual rows that are intentionally held back from
        // the nightly auto-materialiser.
        ["Mode"] = x => x.RecurringMode.ToString(),
        ["Raw Base Amount"] = x => x.RawBaseAmount.HasValue ? x.RawBaseAmount.Value.ToString("0.00") : string.Empty,
        ["Fuel Surcharge"] = x => x.FuelSurchargeAmount.HasValue ? x.FuelSurchargeAmount.Value.ToString("0.00") : string.Empty,
        ["Amount"] = x => x.UcbkAmount.HasValue ? x.UcbkAmount.Value.ToString("0.00") : string.Empty
    };

    /// <summary>
    /// Validates an uploaded file has valid extension.
    /// </summary>
    private static void ValidateUploadedFile(IFormFile file)
    {
        if (file == null || string.IsNullOrWhiteSpace(file.FileName))
        {
            throw new ArgumentException("No file provided.", nameof(file));
        }

        var fileExtension = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!ValidFileExtensions.Contains(fileExtension))
        {
            throw new ArgumentException("Invalid file format. Please upload an Excel (.xls, .xlsx) or CSV file.", nameof(file));
        }
    }

    /// <summary>
    /// Formats a field value for CSV, escaping quotes and handling special characters.
    /// </summary>
    private static string FormatCsvField(object value)
    {
        if (value == null)
        {
            return string.Empty;
        }

        var str = value.ToString();
        if (string.IsNullOrEmpty(str))
        {
            return string.Empty;
        }

        var escaped = str.Replace("\"", "\"\"").Replace("\n", "\\n").Replace("\r", string.Empty);

        return escaped.Contains('"') || escaped.Contains(',')
            ? $"\"{escaped}\""
            : escaped;
    }

    /// <summary>
    /// Sanitizes a string to be safe for use in a filename.
    /// </summary>
    private static string SanitizeFilename(string filename)
    {
        if (string.IsNullOrEmpty(filename))
        {
            return "Unknown";
        }

        var invalidChars = new HashSet<char>(Path.GetInvalidFileNameChars());
        var sanitized = new string(filename.Where(c => !invalidChars.Contains(c)).ToArray());

        if (sanitized.Length > 50)
        {
            sanitized = sanitized[..50];
        }

        return string.IsNullOrWhiteSpace(sanitized) ? "Unknown" : sanitized;
    }

    /// <summary>
    /// Uploads content to S3 for archival.
    /// </summary>
    private async Task UploadToS3Async(byte[] content, string key, string bucketEnvVar)
    {
        var bucketName = Environment.GetEnvironmentVariable(bucketEnvVar);
        if (string.IsNullOrEmpty(bucketName))
        {
            Log.Warning("{BucketEnvVar} environment variable not set. Skipping S3 upload.", bucketEnvVar);
            return;
        }

        using var ms = new MemoryStream(content);
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                ContentType = "text/csv",
                InputStream = ms
            };
            await s3Client.PutObjectAsync(putRequest);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error uploading to S3 with key: {Key}", key);
        }
    }

    /// <summary>
    /// Archives an uploaded file to S3 for record-keeping.
    /// </summary>
    private async Task ArchiveUploadedFileToS3Async(IFormFile file, DateTimeOffset currentDate)
    {
        var timestamp = currentDate.ToString("yyyyMMddHHmmss");
        var key = $"Jobs/{currentDate:yyyy}/{currentDate:MM}/Jobs-{timestamp}";

        using var memoryStream = new MemoryStream();
        await file.CopyToAsync(memoryStream);
        memoryStream.Position = 0;

        try
        {
            var bucketName = Environment.GetEnvironmentVariable("S3BucketMars");
            var putRequest = new PutObjectRequest
            {
                BucketName = bucketName,
                Key = key,
                ContentType = file.ContentType,
                InputStream = memoryStream
            };
            putRequest.Metadata.Add("FileName", file.FileName);
            await s3Client.PutObjectAsync(putRequest);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error archiving job price upload file to S3");
        }
    }
}
