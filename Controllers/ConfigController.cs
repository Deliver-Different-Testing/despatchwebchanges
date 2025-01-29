using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;
using System;

namespace DespatchWeb.Controllers;

public class ConfigController(IWebHostEnvironment environment) : Controller
{

    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        return Json(new { apiKey = Environment.GetEnvironmentVariable("HereMapsAPIKey") });
    }
    
    [HttpGet]
    public IActionResult GetGoogleMapsKey()
    {
        var key = environment.IsDevelopment()
            ? Environment.GetEnvironmentVariable("GoogleMapsDevKey")
            : Environment.GetEnvironmentVariable("GoogleMapsKey");

        return Json(new { apiKey = key });
    }
}
