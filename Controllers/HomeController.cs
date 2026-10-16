#nullable enable
using System.Diagnostics;
using DespatchWeb.Enums;
using DespatchWeb.Interfaces;
using DespatchWeb.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace DespatchWeb.Controllers;

public class HomeController(
    IClientRepository clientRepository,
    IDfrntViewsRepository viewsRepository,
    ITenantInfoService infoService) : Controller
{
    [Authorize]
    public async Task<IActionResult> GetPageViews(int pageId)
    {
        var page = (AppPage)pageId;
        var staffId = infoService.GetStaffId();
        var viewOptions = await viewsRepository.GetViewsByUserAndPageAsync(staffId, page);
        return Json(viewOptions);
    }

    [Authorize]
    public async Task<IActionResult> ActiveClients(string searchTerm)
    {
        var result = await clientRepository.ActiveClientsAsync(searchTerm);
        return Json(result);
    }

    [ResponseCache(Duration = 0, Location = ResponseCacheLocation.None, NoStore = true)]
    public IActionResult Error() => View(new ErrorViewModel { RequestId = Activity.Current?.Id ?? HttpContext.TraceIdentifier });
}
