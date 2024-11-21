using System;
using System.Threading.Tasks;
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
    public async Task<IActionResult> Index()
    {
        try
        {
            var jobs = await _jobRepository.GetJobsForOverviewPage();
            return Json(jobs);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error getting jobs");
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
}
