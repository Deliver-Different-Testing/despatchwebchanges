#nullable enable
using DespatchWeb.Extensions;
using DespatchWeb.Helpers;
using DespatchWeb.Interfaces;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[ApiController]
public class ContextController(
    ISessionContextService sessionContextService,
    IConnectionStringManager connectionStringManager) : ControllerBase
{
    [Authorize]
    [HttpGet("/api/context")]
    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public async Task<IActionResult> Get()
    {
        var hubUrl = Environment.GetEnvironmentVariable("HubUrl");
        try
        {
            var connectionString = User.FindFirst("Connection")?.Value;
            var tenantId = User.FindFirst("CurrentTenantID")?.Value;
            if (string.IsNullOrEmpty(connectionString) || string.IsNullOrEmpty(tenantId))
            {
                Log.Error("Connection string or tenant ID is missing");
                Response.Headers[AuthServiceCollectionExtensions.AuthRedirectHeader] = hubUrl ?? "https://deliverdifferent.com/";
                return StatusCode(StatusCodes.Status401Unauthorized, new {error = "Session is not tied to a tenant."});
            }

            var credentials = Environment.GetEnvironmentVariable("SQLCredentials");
            if (string.IsNullOrEmpty(credentials))
            {
                throw new InvalidOperationException(
                    "Could not find a environment variable string named 'SQLCredentials'.");
            }

            await connectionStringManager.SetConnectionStringAsync(TenantConnectionCache.Key(tenantId),
                connectionString + credentials);

            return Ok(await sessionContextService.BuildAsync(User));
        }
        catch (Exception ex)
        {
            Log.Error(ex, "{Message}", ErrorMessageStringFormatter.FormatForLogging(
                ex, nameof(ContextController), nameof(Get)));
            return StatusCode(StatusCodes.Status500InternalServerError,
                new {error = ErrorMessageStringFormatter.Format(ex)});
        }
    }
}
