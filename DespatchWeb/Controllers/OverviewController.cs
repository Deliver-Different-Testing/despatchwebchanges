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
                parameters.Limit
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
}
