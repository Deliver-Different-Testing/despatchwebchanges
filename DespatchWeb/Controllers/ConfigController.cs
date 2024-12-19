using DespatchWeb.Models.Config;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Controllers;

public class ConfigController : Controller
{
    private readonly IWebHostEnvironment _environment;
    private readonly GoogleMapsConfig _googleConfig;
    private readonly HereMapsConfig _hereConfig;

    public ConfigController(
        IOptions<GoogleMapsConfig> googleConfig,
        IOptions<HereMapsConfig> hereConfig,
        IWebHostEnvironment environment)
    {
        _googleConfig = googleConfig.Value;
        _hereConfig = hereConfig.Value;
        _environment = environment;
    }

    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        return Json(new { apiKey = _hereConfig.ApiKey });
    }

    [HttpGet]
    public IActionResult GetGoogleMapsKey()
    {
        var key = _environment.IsDevelopment()
            ? _googleConfig.ApiKey.Development
            : _googleConfig.ApiKey.Production;

        return Json(new { apiKey = key });
    }
}
