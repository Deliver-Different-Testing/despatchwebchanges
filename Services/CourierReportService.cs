using System.Text;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.Response;
using Serilog;

namespace DespatchWeb.Services;

public sealed class CourierReportService(
    ICourierRepository courierRepository,
    ITenantClock clock) : ICourierReportService
{
    public async Task<(byte[] FileBytes, string FileName)> GenerateTodayActiveDriversCsvAsync(
        TodayActiveDriversFilterRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await courierRepository.GetTodayActiveDriversForExportAsync(request);
            var csvBytes = await GenerateCsvAsync(data, TodayActiveDriversCsvColumns);
            var filename = $"today-active-drivers-{currentDate:yyyy-MM-dd-HHmm}.csv";
            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error generating today active drivers CSV export");
            throw;
        }
    }

    private static readonly Dictionary<string, Func<TodayActiveDriversViewModel, string>> TodayActiveDriversCsvColumns = new()
    {
        ["Code"] = x => FormatCsvField(x.Code),
        ["Name"] = x => FormatCsvField(x.Name),
        ["Fleet"] = x => FormatCsvField(x.Fleet),
        ["Login Time"] = x => x.LoginTime != default ? x.LoginTime.ToString("HH:mm:ss") : string.Empty,
        ["Logout Time"] = x => x.LogoutTime.HasValue ? x.LogoutTime.Value.ToString("HH:mm:ss") : string.Empty,
        ["Duration"] = x => FormatCsvField(x.Duration),
        ["Deliveries"] = x => x.Deliveries.ToString(),
        ["Status"] = x => FormatCsvField(x.Status)
    };

    public async Task<(byte[] FileBytes, string FileName)> GenerateComplianceCsvAsync(
        CourierComplianceFilterRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await courierRepository.GetCourierComplianceForExportAsync(request);
            var csvBytes = await GenerateCsvAsync(data, ComplianceCsvColumns);
            var filename = $"driver-compliance-{currentDate:yyyy-MM-dd-HHmm}.csv";
            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error generating compliance CSV export");
            throw;
        }
    }

    private static readonly Dictionary<string, Func<CourierComplianceViewModel, string>> ComplianceCsvColumns = new()
    {
        ["Code"] = x => FormatCsvField(x.Code),
        ["Name"] = x => FormatCsvField(x.Name),
        ["Type"] = x => FormatCsvField(x.ComplianceType),
        ["Item/Number"] = x => FormatCsvField(x.ItemNumber),
        ["Expiry Date"] = x => x.ExpiryDate.HasValue ? x.ExpiryDate.Value.ToString("dd/MM/yyyy") : string.Empty,
        ["Status"] = x => FormatCsvField(x.Status),
        ["Days Until Expiry"] = x => FormatCsvField(x.DaysUntilExpiry)
    };

    public async Task<(byte[] FileBytes, string FileName)> GenerateAfterHoursScheduleCsvAsync(
        CourierAfterHoursFilterRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await courierRepository.GetAfterHoursScheduleForExportAsync(request);
            var csvBytes = await GenerateCsvAsync(data, AfterHoursScheduleCsvColumns);
            var filename = $"after-hours-schedule-{currentDate:yyyy-MM-dd-HHmm}.csv";
            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error generating after hours schedule CSV export");
            throw;
        }
    }

    private static readonly Dictionary<string, Func<AfterHoursCourierScheduleViewModel, string>> AfterHoursScheduleCsvColumns = new()
    {
        ["Driver Name"] = x => FormatCsvField(x.CourierName),
        ["Driver Code"] = x => FormatCsvField(x.CourierCode),
        ["Days"] = x => x.Days != null ? FormatCsvField(string.Join(", ", x.Days)) : string.Empty,
        ["Start Time"] = x => x.StartTime.HasValue ? x.StartTime.Value.ToString("HH:mm") : string.Empty,
        ["End Time"] = x => x.EndTime.HasValue ? x.EndTime.Value.ToString("HH:mm") : string.Empty,
        ["Duration"] = x => FormatCsvField(x.Duration)
    };

    public async Task<(byte[] FileBytes, string FileName)> GenerateDriverEmailsCsvAsync(PaginatedRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await courierRepository.GetCourierEmailsForExportAsync(request);
            var csvBytes = await GenerateCsvAsync(data, DriverEmailsCsvColumns);
            var filename = $"driver-emails-{currentDate:yyyy-MM-dd-HHmm}.csv";
            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error generating driver emails CSV export");
            throw;
        }
    }

    private static readonly Dictionary<string, Func<CourierEmailViewModel, string>> DriverEmailsCsvColumns = new()
    {
        ["Code"] = x => FormatCsvField(x.Code),
        ["Name"] = x => FormatCsvField(x.Name),
        ["Email"] = x => FormatCsvField(x.Email),
        ["Phone"] = x => FormatCsvField(x.Phone),
        ["Fleet"] = x => FormatCsvField(x.Fleet)
    };

    public async Task<(byte[] FileBytes, string FileName)> GenerateDriverEarningsCsvAsync(PaginatedRequest request)
    {
        try
        {
            var currentDate = clock.TenantNow;
            var data = await courierRepository.GetCourierDailyEarningsForExportAsync(request);
            var csvBytes = await GenerateCsvAsync(data, DriverEarningsCsvColumns);
            var filename = $"driver-earnings-{currentDate:yyyy-MM-dd-HHmm}.csv";
            return (csvBytes, filename);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error generating driver earnings CSV export");
            throw;
        }
    }

    private static readonly Dictionary<string, Func<CourierDailyEarningsViewModel, string>> DriverEarningsCsvColumns = new()
    {
        ["Name"] = x => FormatCsvField(x.Name),
        ["Hours Logged"] = x => x.HoursLogged.ToString("F1"),
        ["Deliveries"] = x => x.Deliveries.ToString(),
        ["Earnings"] = x => x.Earnings.ToString("F2"),
        ["Hourly Rate"] = x => x.HourlyRate.ToString("F2")
    };

    private static async Task<byte[]> GenerateCsvAsync<T>(IEnumerable<T> data, Dictionary<string, Func<T, string>> columns)
    {
        using var stream = new MemoryStream();
        await using var writer = new StreamWriter(stream, new UTF8Encoding(true));

        await writer.WriteLineAsync(string.Join(",", columns.Keys));
        foreach (var item in data)
        {
            var values = columns.Values.Select(extractor => extractor(item));
            await writer.WriteLineAsync(string.Join(",", values));
        }

        await writer.FlushAsync();
        return stream.ToArray();
    }

    private static string FormatCsvField(object value)
    {
        if (value == null) return string.Empty;

        var str = value.ToString();
        if (string.IsNullOrEmpty(str)) return string.Empty;

        var escaped = str.Replace("\"", "\"\"").Replace("\n", "\\n").Replace("\r", "");

        return escaped.Contains('"') || escaped.Contains(',')
            ? $"\"{escaped}\""
            : escaped;
    }
}
