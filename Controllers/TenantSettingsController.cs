using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

/// <summary>
/// Read-only tenant-wide settings for the current tenant. These are written
/// elsewhere (e.g. a tenant admin's Dispatch settings page in the
/// Configurator, which shares the same per-tenant database) — despatchweb
/// only reads them.
/// </summary>
[Authorize]
public class TenantSettingsController(ITenantSettingsService tenantSettingsService) : Controller
{
    public async Task<IActionResult> GetDispatchAddressFormatDefault()
    {
        try
        {
            var json = await tenantSettingsService.GetDispatchAddressFormatDefaultAsync();
            return Json(json);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting tenant dispatch address format default: {Error}", e.Message);
            return StatusCode(500, e.Message);
        }
    }
}
