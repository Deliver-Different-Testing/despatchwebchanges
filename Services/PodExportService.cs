using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using Amazon.S3;
using Amazon.S3.Model;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Serilog;

namespace DespatchWeb.Services;

public class PodExportService(
    IJobRepository jobRepository,
    ITenantInfoService infoService,
    IAmazonS3 s3Client) : IPodExportService
{
    public async Task<JobsReportResult> GenerateJobsReportAsync(PodSearchDownloadRequest request)
    {
        var currentDate = infoService.GetCurrentTenantTime();

        // Fetch data
        var data = await jobRepository.PodSearchDownloadAsync(
            request.CourierId,
            request.SpeedId,
            request.Wild ?? string.Empty,
            request.Job ?? string.Empty,
            request.FromDate.ResetTimeToStartOfDay(),
            request.ToDate.ResetTimeToEndOfDay(),
            request.ClientId
        );

        // Generate CSV
        var csvBytes = await GenerateCsvAsync(data);

        // Upload to S3
        var filename = $"Jobs {currentDate:yyyyMMddHHmmssfff}.csv";
        await UploadToS3Async(csvBytes, currentDate);

        return new JobsReportResult
        {
            FileBytes = csvBytes,
            FileName = filename
        };
    }
    
     private static async Task<byte[]> GenerateCsvAsync(IEnumerable<dynamic> data)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, Encoding.UTF8);
        
        // Write header
        await writer.WriteLineAsync(GetCsvHeader());
        
        // Write data rows
        foreach (var item in data) await writer.WriteLineAsync(FormatDataRow(item));
        
        return stream.ToArray();
    }

   private static readonly Dictionary<string, Func<dynamic, string>> CsvColumns = new()
    {
        // Basic job info
        ["Id"] = x => x.Id?.ToString(),
        ["JobNumber"] = x => FormatField(x.JobNumber),
        ["CustomerName"] = x => x.CustomerName?.ToString(),
        ["CourierCode"] = x => FormatField(x.CourierCode),
        ["BookDate"] = x => ((DateTime?)x.BookDate)?.ToString("yyyy-MM-dd HH:mm:ss"),
        ["PickedUpDate"] = x => x.PickedUpDate?.ToString(),
        ["DeliveredDate"] = x => x.DeliveredDate?.ToString(),
        
        // Financial info
        ["Amount"] = x => x.Amount?.ToString(),
        ["Fuel"] = x => x.Fuel?.ToString(),
        ["Ppd"] = x => x.Ppd?.ToString(),
        ["CourierPayment"] = x => x.CourierPayment?.ToString(),
        ["CourierFuel"] = x => x.CourierFuel?.ToString(),
        ["CourierBonus"] = x => x.CourierBonus?.ToString(),
        ["RawBaseAmount"] = x => x.RawBaseAmount?.ToString(),
        
        // Agent/AWB info
        ["Agent/Airline Name"] = x => x.AgentAirlineName?.ToString(),
        ["AWB#"] = x => x.AWB?.ToString(),
        
        // Package info
        ["Quantity"] = x => x.Quantity?.ToString(),
        ["Weight"] = x => x.Weight?.ToString(),
        ["Size"] = x => x.Size?.ToString(),
        ["StatusName"] = x => x.StatusName?.ToString(),
        
        // Pickup address lines
        ["PickupAddressLine1"] = x => FormatField(x.PickupAddressLine1),
        ["PickupAddressLine2"] = x => FormatField(x.PickupAddressLine2),
        ["PickupAddressLine3"] = x => FormatField(x.PickupAddressLine3),
        ["PickupAddressLine4"] = x => FormatField(x.PickupAddressLine4),
        ["PickupAddressLine5"] = x => FormatField(x.PickupAddressLine5),
        ["PickupAddressLine6"] = x => FormatField(x.PickupAddressLine6),
        ["PickupAddressLine7"] = x => FormatField(x.PickupAddressLine7),
        ["PickupAddressLine8"] = x => FormatField(x.PickupAddressLine8),
        
        // Delivery address lines
        ["DeliveryAddressLine1"] = x => FormatField(x.DeliveryAddressLine1),
        ["DeliveryAddressLine2"] = x => FormatField(x.DeliveryAddressLine2),
        ["DeliveryAddressLine3"] = x => FormatField(x.DeliveryAddressLine3),
        ["DeliveryAddressLine4"] = x => FormatField(x.DeliveryAddressLine4),
        ["DeliveryAddressLine5"] = x => FormatField(x.DeliveryAddressLine5),
        ["DeliveryAddressLine6"] = x => FormatField(x.DeliveryAddressLine6),
        ["DeliveryAddressLine7"] = x => FormatField(x.DeliveryAddressLine7),
        ["DeliveryAddressLine8"] = x => FormatField(x.DeliveryAddressLine8),
        
        // Client references
        ["ClientReferenceA"] = x => FormatField(x.ClientReferenceA),
        ["ClientReferenceB"] = x => FormatField(x.ClientReferenceB),
        ["ClientReferenceC"] = x => FormatField(x.ClientReferenceC),
        
        // Invoice info
        ["InvoiceNumber"] = x => x.InvoiceNumber?.ToString(),
        ["InvoiceDate"] = x => x.InvoiceDate?.ToString(),
        ["IsArchived"] = x => x.IsArchived?.ToString(),
        ["LoggedInContact"] = x => FormatField(x.LoggedInContact)
    };

    private static string GetCsvHeader() => string.Join(",", CsvColumns.Keys);

    private static string FormatDataRow(dynamic x)
    {
        var values = CsvColumns.Values.Select(extractor => extractor(x) ?? string.Empty);
        return string.Join(",", values);
    }
    
    private async Task UploadToS3Async(byte[] csvBytes, DateTime currentDate)
    {
        var folder = currentDate.ToString("yyyyMM");
        var timestamp = currentDate.ToString("yyyyMMddHHmmss");
        var key = $"Jobs/{folder}/Jobs-{timestamp}";

        using var ms = new MemoryStream(csvBytes);
        
        try
        {
            var putRequest = new PutObjectRequest
            {
                BucketName = Environment.GetEnvironmentVariable("S3Bucket"),
                //BucketName = Environment.GetEnvironmentVariable("S3BucketMars"),
                Key = key,
                ContentType = "text/csv",
                InputStream = ms
            };
            
            await s3Client.PutObjectAsync(putRequest);
        }
        catch (AmazonS3Exception ex)
        {
            Log.Error(ex, "S3 error when uploading jobs download file with key: {Key}", key);
            throw;
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Unexpected error when uploading jobs download file to S3 with key: {Key}", key);
            throw;
        }
    }

    private static string FormatField(object value)
    {
        var formatted = value?.ToString()?.Replace("\"", "\"\"").Replace("\n", "\\n") ?? string.Empty;

        return formatted.Contains('"') || formatted.Contains(',')
            ? $"\"{formatted}\""
            : formatted;
    }
}