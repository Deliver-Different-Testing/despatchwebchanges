using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

/// <summary>
/// A generic per-staff-member preference store (StaffPreference: one JSON blob
/// per key). PreferenceKey is restricted to the <see cref="StaffPreferenceKey"/>
/// allow-list so the table doesn't silently accumulate arbitrary keys from a
/// compromised or buggy client — add a member there when a page adopts this
/// for a new setting.
/// </summary>
[Authorize]
public class StaffPreferenceController(IStaffPreferenceRepository staffPreferenceRepository) : Controller
{
    // Enum.TryParse also accepts the underlying numeric value (e.g. "0"), which
    // isn't a real key name, so integer-shaped input is rejected explicitly.
    private static bool IsAllowedKey(string key) =>
        !int.TryParse(key, out _) && Enum.TryParse<StaffPreferenceKey>(key, out _);

    public async Task<IActionResult> GetPreference(string key)
    {
        try
        {
            if (!IsAllowedKey(key))
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
            if (!IsAllowedKey(request.PreferenceKey))
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

    [HttpPost]
    public async Task<IActionResult> DeletePreference(string key)
    {
        try
        {
            if (!IsAllowedKey(key))
            {
                return BadRequest("Invalid preference key");
            }

            await staffPreferenceRepository.DeletePreferenceAsync(key);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error deleting staff preference {Key}: {Error}", key, e.Message);
            return StatusCode(500, e.Message);
        }
    }
}
