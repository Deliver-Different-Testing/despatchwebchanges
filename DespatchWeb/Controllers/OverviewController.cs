using System;
using System.Threading.Tasks;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
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
    public async Task<IActionResult> Index([FromQuery] int statusGroup = 1)
    {
        try
        {
            // Convert int to enum
            if (!Enum.IsDefined(typeof(JobStatusGroup), statusGroup))
                return BadRequest($"Invalid status group: {statusGroup}");

            var statusEnum = (JobStatusGroup)statusGroup;

            // Get jobs filtered by status group
            var jobs = await _jobRepository.GetJobsForOverviewPageAsync(statusEnum);
            return Json(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting jobs for status group {StatusGroup}: {Error}",
                statusGroup, ex.Message);
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
