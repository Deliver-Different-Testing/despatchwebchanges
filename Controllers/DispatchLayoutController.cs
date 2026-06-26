using DespatchWeb.Interfaces;
using DespatchWeb.Models.RequestModels;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Serilog;

namespace DespatchWeb.Controllers;

[Authorize]
public class DispatchLayoutController(IDispatchLayoutRepository dispatchLayoutRepository) : Controller
{
    private static readonly HashSet<string> AllowedPages = new(StringComparer.Ordinal)
    {
        "JobSearch",
        "Dispatch"
    };

    public async Task<IActionResult> GetLayouts(string page)
    {
        try
        {
            if (!AllowedPages.Contains(page))
            {
                return BadRequest("Invalid page");
            }

            var layouts = await dispatchLayoutRepository.GetLayoutsAsync(page);
            return Json(layouts);
        }
        catch (Exception e)
        {
            Log.Error(e, "Error getting dispatch layouts for page {Page}: {Error}", page, e.Message);
            return StatusCode(500, e.Message);
        }
    }

    [HttpPost]
    public async Task<IActionResult> SaveLayouts([FromBody] SaveDispatchLayoutsRequest request)
    {
        try
        {
            if (!AllowedPages.Contains(request.Page))
            {
                return BadRequest("Invalid page");
            }

            if (request.Layouts.Any(l => string.IsNullOrEmpty(l.Name) || string.IsNullOrEmpty(l.LayoutJson)))
            {
                return BadRequest("Each layout must have a name and layout JSON");
            }

            await dispatchLayoutRepository.ReplaceLayoutsAsync(request.Page, request.Layouts);
            return Ok();
        }
        catch (Exception e)
        {
            Log.Error(e, "Error saving dispatch layouts for page {Page}: {Error}", request.Page, e.Message);
            return StatusCode(500, e.Message);
        }
    }
}
