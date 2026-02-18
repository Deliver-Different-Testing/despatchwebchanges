using System.Threading.Tasks;
using DespatchWeb.Models;

namespace DespatchWeb.Interfaces;

public interface ICourierReportService
{
    Task<(byte[] FileBytes, string FileName)> GenerateTodayActiveDriversCsvAsync(TodayActiveDriversFilterRequest request);
    Task<(byte[] FileBytes, string FileName)> GenerateComplianceCsvAsync(CourierComplianceFilterRequest request);
    Task<(byte[] FileBytes, string FileName)> GenerateAfterHoursScheduleCsvAsync(CourierAfterHoursFilterRequest request);
    Task<(byte[] FileBytes, string FileName)> GenerateDriverEmailsCsvAsync(PaginatedRequest request);
    Task<(byte[] FileBytes, string FileName)> GenerateDriverEarningsCsvAsync(PaginatedRequest request);
}
