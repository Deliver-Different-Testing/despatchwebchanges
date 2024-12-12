using DespatchWeb.Models.Config;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Controllers;

public class ConfigController : Controller
{
    private readonly HereMapsConfig _config;

    public ConfigController(IOptions<HereMapsConfig> config)
    {
        _config = config.Value;
    }

    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        return Json(new { apiKey = _config.ApiKey });
    }
}
