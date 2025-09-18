using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

public class CourierController(
    ICourierRepository courierRepository,
    ITaskRepository taskRepository
) : Controller
{
    public async Task<IActionResult> Index([FromQuery] List<int> despatchViewIds)
    {
        try
        {
            if (despatchViewIds == null || despatchViewIds.Count == 0)
                despatchViewIds = [49];

            var result = await courierRepository.GetClearListsAsync(despatchViewIds);
            return Json(result);
        }
        catch (Exception e)
        {
            Log.Error(e, "An error occurred getting clear lists");
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }

    public async Task<IActionResult> ClearListEnvelope(int clearListId, int countryId)
    {
        try
        {
            var country = (Country)countryId;
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

    public async Task<IActionResult> PotentialCouriers(int jobId)
    {
        try
        {
            var result = await courierRepository.GetPotentialCouriersAsync(jobId);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting potential couriers");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> AllActiveSearch(string searchTerm)
    {
        try
        {
            var result = await courierRepository.AllActiveCouriersAsync(searchTerm);
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error searching active couriers");
            return StatusCode(500, ErrorMessageStringFormatter.Format(ex));
        }
    }

    public async Task<IActionResult> AllActive()
    {
        try
        {
            var result = await courierRepository.AllActiveCouriersAsync();
            return Json(result);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting all active couriers");
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
    public async Task<IActionResult> AddFollowupEvent(int jobId, int staffId,
        string despatcherName)
    {
        try
        {
            await taskRepository.AddEventAsync(
                jobId,
                staffId,
                despatcherName,
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
    public async Task<IActionResult> GetCourierComplianceList([FromBody] CourierComplianceFilterRequest  request)
    {
        try
        {
            var complianceList = await courierRepository.GetAllCourierComplianceAsync(request);
            return Json(complianceList);
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
    public async Task<IActionResult> GetAfterHoursCourierSchedule([FromBody] CourierAfterHoursFilterRequest request)
    {
        try
        {
            var afterHoursSchedule = await courierRepository.GetAfterHoursCourierScheduleAsync(request);
            return Json(afterHoursSchedule);
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

    public async Task<IActionResult> GetCourierDailyEarnings([FromBody] PaginatedRequest request)
    {
        try
        {
            var courierEarnings = await courierRepository.GetCourierDailyEarningsAsync(request);
            return Json(courierEarnings);
        }
        catch (Exception e)
        {
            Log.Error(e, "{Message}",
                ErrorMessageStringFormatter.FormatForLogging(e, nameof(CourierController),
                    nameof(GetCourierDailyEarnings)));
            return StatusCode(500, ErrorMessageStringFormatter.Format(e));
        }
    }
}