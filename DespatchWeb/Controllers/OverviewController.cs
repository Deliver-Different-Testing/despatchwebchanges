using System;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace DespatchWeb.Controllers;

public class OverviewController : Controller
{
    private readonly ICourierRepository _courierRepository;
    private readonly IJobRepository _jobRepository;
    private readonly ILogger<OverviewController> _logger;

    public OverviewController(IJobRepository jobRepository, ILogger<OverviewController> logger,
        ICourierRepository courierRepository)
    {
        _jobRepository = jobRepository;
        _logger = logger;
        _courierRepository = courierRepository;
    }

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
            var paginatedJobs = await _jobRepository.GetJobsForOverviewPageAsync(
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
            _logger.LogError(ex, "Error getting jobs for status group {StatusGroup}: {Error}",
                parameters.StatusGroup, ex.Message);
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllRegions()
    {
        try
        {
            var regions = await _courierRepository.GetAllRegionsAsync();
            return Json(regions);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting regions");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetStats()
    {
        try
        {
            var stats = await _jobRepository.GetOverviewStatsAsync();
            return Json(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting overview stats");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetParentJobMap(int jobId)
    {
        try
        {
            var locations = await _jobRepository.GetOverviewLocationDataAsync(jobId);
            return Json(locations);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error getting map coordinates for JobId: {jobId}");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetAllSpeeds()
    {
        try
        {
            var speeds = await _courierRepository.GetAllSpeedsAsync();
            return Json(speeds);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting speeds");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetJobsForMegaMap()
    {
        try
        {
            var jobs = await _jobRepository.GetJobsForMegaMapAsync();
            return Json(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting jobs for mega map");
            return StatusCode(500);
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetOpenJobs([FromQuery] OpenJobsRequest parameters)
    {
        try
        {
            _logger.LogInformation("Retrieving open jobs");
            var jobs = await _jobRepository.GetOpenJobsAsync(
                parameters.StartDate,
                parameters.EndDate,
                parameters.Regions,
                parameters.Speeds);
            _logger.LogInformation("Successfully retrieved {JobCount} open jobs", jobs.Count);
            return Json(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving open jobs");
            return StatusCode(500, new { message = "An unexpected error occurred while retrieving open jobs" });
        }
    }

    [HttpGet]
    public async Task<IActionResult> GetDriverStats(int courierId)
    {
        try
        {
            _logger.LogInformation("Getting driver stats for courier ID: {CourierId}", courierId);
            var driverStats = await _jobRepository.GetDriverStatsAsync(courierId);
            _logger.LogInformation("Successfully retrieved driver stats for courier ID: {CourierId}", courierId);
            return Json(driverStats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error retrieving driver stats for courier ID: {CourierId}", courierId);
            return StatusCode(500, "An error occurred while retrieving driver statistics");
        }
    }
}
