using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.Accessorial;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
[Route("AccessorialCharge")]
public class AccessorialChargeController(IAccessorialChargeService accessorialChargeService) : Controller
{
    [HttpGet("GetAvailable")]
    public async Task<IActionResult> GetAvailable(int accessorialChargeGroupId, int jobId)
    {
        try
        {
            var charges = await accessorialChargeService.GetAvailableChargesAsync(accessorialChargeGroupId, jobId);
            return Json(charges);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(GetAvailable));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("GetApplied")]
    public async Task<IActionResult> GetApplied(int jobId)
    {
        try
        {
            var charges = await accessorialChargeService.GetAppliedChargesAsync(jobId);
            return Json(charges);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(GetApplied));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost("Add")]
    public async Task<IActionResult> Add(int jobId, [FromBody] List<JobAccessorialChargeCreateRequest> charges)
    {
        try
        {
            await accessorialChargeService.AddChargesAsync(jobId, charges);
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(Add));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPut("Update")]
    public async Task<IActionResult> Update(int jobAccessorialChargeId, [FromBody] JobAccessorialChargeUpdateRequest request)
    {
        try
        {
            var updated = await accessorialChargeService.UpdateChargeAsync(jobAccessorialChargeId, request);
            return Json(updated);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(Update));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("JobAmount")]
    public async Task<IActionResult> JobAmount(int jobId)
    {
        try
        {
            var amount = await accessorialChargeService.GetJobAmountAsync(jobId);
            return Json(amount);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(JobAmount));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpGet("GetPortions")]
    public async Task<IActionResult> GetPortions(int parentJobId)
    {
        try
        {
            var portions = await accessorialChargeService.GetPortionJobsAsync(parentJobId);
            return Json(portions);
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(GetPortions));
            return StatusCode(500, ex.Message);
        }
    }

    [HttpDelete("Delete")]
    public async Task<IActionResult> Delete(int jobAccessorialChargeId)
    {
        try
        {
            await accessorialChargeService.DeleteChargeAsync(jobAccessorialChargeId);
            return Json(new { success = true });
        }
        catch (Exception ex)
        {
            Log.Error(ex, "Error in {Controller}.{Action}", nameof(AccessorialChargeController), nameof(Delete));
            return StatusCode(500, ex.Message);
        }
    }
}
