using System;
using DespatchWeb.Models.Response;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Hosting;

namespace DespatchWeb.Controllers;

public class ConfigController(IWebHostEnvironment environment) : Controller
{

    [HttpGet]
    public IActionResult GetHereMapsKey()
    {
        var apiKey = new ApiKeyResponse(Environment.GetEnvironmentVariable("HereMapsAPIKey"));
        return Json(apiKey);
    }

    [HttpGet]
    public IActionResult GetGoogleMapsKey()
    {
        var apiKey = new ApiKeyResponse(
            environment.IsDevelopment()
            ? Environment.GetEnvironmentVariable("GoogleMapsDevKey")
            : Environment.GetEnvironmentVariable("GoogleMapsKey")
        );

        return Json(apiKey);
    }
}
