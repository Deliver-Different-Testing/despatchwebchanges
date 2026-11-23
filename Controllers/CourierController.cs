using DespatchWeb.Enums;
using DespatchWeb.Filters;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class CourierController(
    ICourierRepository courierRepository,
    ITenantInfoService infoService,
    ITaskRepository taskRepository,
    ICourierReportService courierReportService,
    IComplianceReminderService complianceReminderService,
    IDriverTopUpStatusService? topUpStatusService = null,
    DespatchWeb.Services.IAccessKeyService? accessKeys = null,
    IDriverEarlyFinishService? earlyFinishService = null
) : Controller
{
    public async Task<IActionResult> Index(
        [FromQuery] List<int> despatchViewIds,
        [FromQuery] DateTimeOffset? startDate = null,
        [FromQuery] DateTimeOffset? endDate = null,
        [FromQuery] bool useTime = false)
    {
        try
        {
            if (despatchViewIds == null || despatchViewIds.Count == 0)
            {
                return Json(new ClearListViewModel());
            }

            var result = await courierRepository.GetClearListsAsync(despatchViewIds, startDate, endDate, useTime);

            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occurred getting clear lists");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ClearListEnvelope(int clearListId)
    {
        try
        {
            var country = infoService.IsUsTenant() ? Country.Us : infoService.IsAuTenant() ? Country.Au : Country.Nz;
            var result = await courierRepository.GetClearListAreaEnvelopeAsync(clearListId, country);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting clear list envelopes");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> Active()
    {
        try
        {
            var result = await courierRepository.ActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting active couriers");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> AvailableCourierLocation(CourierLocationRequest request)
    {
        try
        {
            var result = await courierRepository.GetAvailableCouriersAsync(request);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting available courier locations");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public Task<IActionResult> PotentialCouriers(int jobId)
    {
        return Task.FromResult<IActionResult>(Json(new List<PotentialCouriersViewModel>()));
    }

    public async Task<IActionResult> AllActiveSearch(string searchTerm, bool dgOnly = false, bool loggedInOnly = false)
    {
        try
        {
            var result = await courierRepository.AllActiveCouriersAsync(searchTerm, dgOnly, loggedInOnly);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error searching active couriers");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> TruckCourierStatus(int courierId)
    {
        try
        {
            var result = await courierRepository.TruckCourierStatusAsync(courierId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting truck courier status");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    [HttpPost]
    public async Task<IActionResult> AddFollowupEvent(int jobId)
    {
        try
        {
            await taskRepository.AddEventAsync(
                jobId,
                "Follow up dangerous goods license with courier",
                (int)EventType.DangerousGoods);
            return Json("OK");
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error adding followup event");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetVehicleSizes()
    {
        try
        {
            var vehicleSizes = await courierRepository.GetVehicleSizesAsync();
            return Json(vehicleSizes);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting vehicle sizes");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetCourier(int courierId)
    {
        try
        {
            var courier = await courierRepository.GetCourierByIdAsync(courierId);
            return Json(courier);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error find courier");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> SearchAllCouriers(string searchTerm)
    {
        try
        {
            var couriers = await courierRepository.SearchAllCouriersAsync(searchTerm);
            return Json(couriers);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(SearchAllCouriers)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetCourierDetailsForDashboard(int courierId)
    {
        try
        {
            var courierData = await courierRepository.GetCourierDetailsForDashboardAsync(courierId);
            return Json(courierData);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetCourierDetailsForDashboard)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetCourierComplianceList([FromBody] CourierComplianceFilterRequest request)
    {
        try
        {
            var complianceList = await courierRepository.GetAllCourierComplianceAsync(request);
            return Json(complianceList);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetCourierComplianceList)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendComplianceReminders([FromBody] SendComplianceRemindersRequest request)
    {
        try
        {
            if (request is null || !request.HasExactlyOneTarget)
            {
                return BadRequest("Specify exactly one of courierIds or filter.");
            }

            var result = await complianceReminderService.SendAsync(request);
            return Json(result);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(SendComplianceReminders)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetAfterHoursCourierSchedule([FromBody] CourierAfterHoursFilterRequest request)
    {
        try
        {
            var afterHoursSchedule = await courierRepository.GetAfterHoursCourierScheduleAsync(request);
            return Json(afterHoursSchedule);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetAfterHoursCourierSchedule)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetTodayActiveDrivers([FromBody] TodayActiveDriversFilterRequest request)
    {
        try
        {
            var todayActiveDrivers = await courierRepository.GetTodayActiveDriversAsync(request);
            return Json(todayActiveDrivers);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetTodayActiveDrivers)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetAllFleetOptions()
    {
        try
        {
            var fleetOptions = await courierRepository.GetAllFleetOptionsAsync();
            return Json(fleetOptions);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetAllFleetOptions)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    /// <summary>Whether the caller may record a driver early finish, and the standard reasons to offer.</summary>
    [HttpGet]
    public async Task<IActionResult> GetEarlyFinishOptions()
    {
        try
        {
            if (earlyFinishService == null)
            {
                return Json(new EarlyFinishOptions { Available = false });
            }

            return Json(await earlyFinishService.GetOptionsAsync());
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetEarlyFinishOptions)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    /// <summary>Records that a driver finished early / disappeared / broke down at a time (informs the top-up approval).</summary>
    [HttpPost]
    public async Task<IActionResult> RecordEarlyFinish([FromBody] RecordEarlyFinishRequest request)
    {
        try
        {
            if (earlyFinishService == null)
            {
                return NotFound();
            }

            await earlyFinishService.RecordAsync(request);
            return Ok();
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (ArgumentException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(RecordEarlyFinish)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    /// <summary>
    /// The dispatcher's pay-period overview: days worked, deliveries and how far behind each eligible driver is.
    /// Never returns rates, minimum hours or owed amounts; hours only when the tenant turns them on.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetDriverPayPeriodOverview()
    {
        try
        {
            var available = accessKeys != null && topUpStatusService != null
                            && await accessKeys.HasAsync(DespatchWeb.Constants.DashboardFeatureKeys.DriverEarningsStatus);
            if (!available)
            {
                return Json(new { available = false, showHours = false, items = Array.Empty<object>() });
            }

            var statuses = await topUpStatusService!.GetStatusesAsync();
            var showHours = statuses.Any(s => s.ShowHours);
            var items = statuses
                .OrderByDescending(s => s.BehindBy)
                .ThenBy(s => s.Name)
                .Select(s => new
                {
                    courierId = s.CourierId,
                    name = s.Name,
                    code = s.Code,
                    daysWorked = s.DaysWorked,
                    deliveries = s.Deliveries,
                    behindBy = s.BehindBy > 0 ? s.BehindBy : (decimal?)null,
                    hours = showHours ? s.PaidHours : (decimal?)null
                })
                .ToList();
            return Json(new { available = true, showHours, items });
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetDriverPayPeriodOverview)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetCourierDailyEarnings([FromBody] PaginatedRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            var courierEarnings = await courierRepository.GetCourierDailyEarningsAsync(request);
            return Json(courierEarnings);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetCourierDailyEarnings)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> GetAllCourierEmails([FromBody] PaginatedRequest request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            var courierEmails = await courierRepository.GetCourierEmailsAsync(request);
            return Json(courierEmails);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetAllCourierEmails)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> SendEmailToCouriers([FromBody] GroupEmailDataViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            await courierRepository.SendEmailToCouriersAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(SendEmailToCouriers)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    [RequireScope(ScopedRecord.Courier, "request.CourierId")]
    public async Task<IActionResult> UpdateAfterHoursCourierSchedule(
        [FromBody] AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            await courierRepository.UpdateAfterHoursCourierScheduleAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(UpdateAfterHoursCourierSchedule)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    [RequireScope(ScopedRecord.Courier, "request.CourierId")]
    public async Task<IActionResult> CreateAfterHoursCourierSchedule(
        [FromBody] AfterHoursCourierScheduleViewModel request)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(request);
            await courierRepository.CreateAfterHoursCourierScheduleAsync(request);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(CreateAfterHoursCourierSchedule)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpDelete]
    public async Task<IActionResult> DeleteAfterHoursCourierSchedule(int afterHoursScheduleId)
    {
        try
        {
            await courierRepository.DeleteAfterHoursCourierScheduleAsync(afterHoursScheduleId);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(DeleteAfterHoursCourierSchedule)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> GetExactCourierByCode(string courierCode)
    {
        try
        {
            ArgumentNullException.ThrowIfNull(courierCode);
            var courier = await courierRepository.GetExactCourierByCodeAsync(courierCode);
            return Json(courier);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetExactCourierByCode)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ClearListDebug(int courierId)
    {
        try
        {
            var result = await courierRepository.GetClearListDebugAsync(courierId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting clear list debug for courier {CourierId}", courierId);
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> GetDriverWorkOverview()
    {
        try
        {
            var drivers = await courierRepository.GetDriverWorkOverviewAsync();
            return Json(drivers);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetDriverWorkOverview)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExportTodayActiveDriversCsv([FromBody] TodayActiveDriversFilterRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await courierReportService.GenerateTodayActiveDriversCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(ExportTodayActiveDriversCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExportComplianceCsv([FromBody] CourierComplianceFilterRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await courierReportService.GenerateComplianceCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(ExportComplianceCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExportAfterHoursScheduleCsv([FromBody] CourierAfterHoursFilterRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await courierReportService.GenerateAfterHoursScheduleCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(ExportAfterHoursScheduleCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExportDriverEmailsCsv([FromBody] PaginatedRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await courierReportService.GenerateDriverEmailsCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(ExportDriverEmailsCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    [HttpPost]
    public async Task<IActionResult> ExportDriverEarningsCsv([FromBody] PaginatedRequest request)
    {
        try
        {
            var (fileBytes, fileName) = await courierReportService.GenerateDriverEarningsCsvAsync(request);
            return File(fileBytes, "text/csv", fileName);
        }
        catch (InvalidListQueryException e)
        {
            return BadRequest(e.Message);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(ExportDriverEarningsCsv)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }
}