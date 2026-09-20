using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

/// <summary>
/// A generic per-staff-member preference store (StaffPreference: one JSON blob
/// per key). PreferenceKey is restricted to a known allow-list so the table
/// doesn't silently accumulate arbitrary keys from a compromised or buggy
/// client — add the new key here when a page adopts this for a setting.
/// </summary>
[Authorize]
public class StaffPreferenceController(IStaffPreferenceRepository staffPreferenceRepository) : Controller
{
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.Ordinal)
    {
        "AutoMate",
    };

    public async Task<IActionResult> GetPreference(string key)
    {
        try
        {
            if (!AllowedKeys.Contains(key))
            {
                return BadRequest("Invalid preference key");
            }

            var preferenceJson = await staffPreferenceRepository.GetPreferenceAsync(key);
            return Json(preferenceJson);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting staff preference {Key}: {Error}", key, e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> SavePreference([FromBody] SavePreferenceRequest request)
    {
        try
        {
            if (!AllowedKeys.Contains(request.PreferenceKey))
            {
                return BadRequest("Invalid preference key");
            }

            if (string.IsNullOrEmpty(request.PreferenceJson))
            {
                return BadRequest("PreferenceJson is required");
            }

            await staffPreferenceRepository.SetPreferenceAsync(request.PreferenceKey, request.PreferenceJson);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error saving staff preference {Key}: {Error}", request.PreferenceKey, e.Message);
            return StatusCode(500, e.Message);
        }
    }
}
