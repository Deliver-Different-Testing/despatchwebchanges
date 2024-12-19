using System;
using DespatchWeb.Models.Config;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;

namespace DespatchWeb.Controllers;

public class ConfigController(IOptions<HereMapsConfig> config) : Controller
{
    private readonly HereMapsConfig _config = config.Value;

    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        return Json(new { apiKey = Environment.GetEnvironmentVariable("HereMapsAPIKey") });
    }
}
