using System;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Serilog;

namespace DespatchWeb.Controllers;

public class OverviewController(
    IJobRepository jobRepository,
    ICourierRepository courierRepository)
    : Controller
{
    [HttpGet]
    public async Task<IActionResult> Index([FromQuery] OverviewJobsRequest parameters)
    {
        try
        {
            // Validate status group
            if (!Enum.IsDefined(typeof(JobStatusGroup), parameters.StatusGroup))
                return BadRequest($"Invalid status group: {parameters.StatusGroup}");

            var statusEnum = (JobStatusGroup)parameters.StatusGroup;

            // Get paginated jobs
            var paginatedJobs = await jobRepository.GetJobsForOverviewPageAsync(
                statusEnum,
                parameters.Page,
                parameters.Limit,
                true,
                parameters.Search,
                parameters.StartDate,
                parameters.EndDate,
                parameters.OrderBy,
                parameters.OrderDirection,
                parameters.Regions,
                parameters.Speeds
            );

            return Json(paginatedJobs);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting jobs for status group {StatusGroup}: {Error}",
                parameters.StatusGroup, ex.Message);
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllRegions()
    {
        try
        {
            var regions = await courierRepository.GetAllRegionsAsync();
            return Json(regions);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting regions");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var stats = await jobRepository.GetOverviewStatsAsync();
            return Json(stats);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting overview stats");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetParentJobMap(int jobId)
    {
        try
        {
            var locations = await jobRepository.GetOverviewLocationDataAsync(jobId);
            return Json(locations);
        }
        catch (Exception ex)
        {
            Log.Error(ex, $"Error getting map coordinates for JobId: {jobId}");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllSpeeds()
    {
        try
        {
            var speeds = await courierRepository.GetAllSpeedsAsync();
            return Json(speeds);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting speeds");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetJobsForMegaMap()
    {
        try
        {
            var jobs = await jobRepository.GetJobsForMegaMapAsync();
            return Json(jobs);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error getting jobs for mega map");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenJobs([FromQuery] OpenJobsRequest parameters)
    {
        try
        {
            Log.Information("Retrieving open jobs");
            var jobs = await jobRepository.GetOpenJobsAsync(
                parameters.StartDate,
                parameters.EndDate,
                parameters.Regions,
                parameters.Speeds);
            Log.Information("Successfully retrieved {JobCount} open jobs", jobs.Count);
            return Json(jobs);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving open jobs");
            return StatusCode(500, new { message = "An unexpected error occurred while retrieving open jobs" });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDriverStats(int courierId)
    {
        try
        {
            Log.Information("Getting driver stats for courier ID: {CourierId}", courierId);
            var driverStats = await jobRepository.GetDriverStatsAsync(courierId);
            Log.Information("Successfully retrieved driver stats for courier ID: {CourierId}", courierId);
            return Json(driverStats);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error retrieving driver stats for courier ID: {CourierId}", courierId);
            return StatusCode(500, "An error occurred while retrieving driver statistics");
        }
    }
}
