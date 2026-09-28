using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

[Authorize]
[ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
public class ConfigController : Controller
{
    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        var apiKey = new ApiKeyResponse(Environment.GetEnvironmentVariable("HereMapsAPIKey"));
        return Json(apiKey);
    }

    [HttpGet]
    public IActionResult GetHereMapsConfig()
    {
        var appId = Environment.GetEnvironmentVariable("HereMapsID");
        var appCode = Environment.GetEnvironmentVariable("HereMapsCode");

        return Json(new { appId, appCode });
    }
}
