using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class UserPreferenceController(IUserPreferenceRepository preferenceRepository) : Controller
{
    /// <summary>
    /// Keys this endpoint will serve. An allow-list rather than a free-for-all so a
    /// caller cannot use the store as arbitrary per-user scratch space — the same
    /// shape <c>DispatchLayoutController</c> uses for its pages.
    /// </summary>
    private static readonly HashSet<string> AllowedKeys = new(StringComparer.Ordinal)
    {
        PreferenceKeys.AutoMate
    };

    /// <summary>Payloads are small settings blobs; anything larger is not one.</summary>
    private const int MaxPreferenceJsonLength = 8000;

    public async Task<IActionResult> Get(string key)
    {
        try
        {
            if (!AllowedKeys.Contains(key))
            {
                return BadRequest("Unknown preference key");
            }

            var json = await preferenceRepository.GetAsync(key);

            // Null is the honest answer for "never saved one" — it is what tells the
            // client to fall back to the default rather than to an empty object.
            return Json(new PreferenceResponse { Key = key, PreferenceJson = json });
        }
        catch (Exception e)
        {
            Log.Error(e, "Error reading preference {Key}: {Error}", key, e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> Save([FromBody] SavePreferenceRequest request)
    {
        try
        {
            if (request is null || !AllowedKeys.Contains(request.Key))
            {
                return BadRequest("Unknown preference key");
            }

            if (string.IsNullOrWhiteSpace(request.PreferenceJson))
            {
                return BadRequest("Preference JSON is required");
            }

            if (request.PreferenceJson.Length > MaxPreferenceJsonLength)
            {
                return BadRequest("Preference JSON is too large");
            }

            await preferenceRepository.SaveAsync(request.Key, request.PreferenceJson);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error saving preference {Key}: {Error}", request?.Key, e.Message);
            return StatusCode(500, e.Message);
        }
    }
}
